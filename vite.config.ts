import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Make sure process.env has the variables for local API handlers
  Object.assign(process.env, env);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              try {
                // Extract path and remove query params
                const url = new URL(req.url, `http://${req.headers.host}`);
                const apiPath = url.pathname.replace(/^\/api\//, '');

                // Try to find the handler file
                const handlerPath = path.resolve(__dirname, 'api', `${apiPath}.ts`);

                // Use dynamic import with a cache-busting timestamp for dev
                const module = await server.ssrLoadModule(handlerPath);
                const handler = module.default;

                if (typeof handler === 'function') {
                  // Mock Vercel req/res objects
                  const vercelRes = {
                    status: (code: number) => {
                      res.statusCode = code;
                      return vercelRes;
                    },
                    json: (data: any) => {
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                      return vercelRes;
                    },
                    setHeader: (name: string, value: string) => {
                      res.setHeader(name, value);
                      return vercelRes;
                    }
                  };

                  // Handle body parsing for POST/PUT
                  let body = {};
                  if (req.method === 'POST' || req.method === 'PUT') {
                    const buffers = [];
                    for await (const chunk of req) {
                      buffers.push(chunk);
                    }
                    const data = Buffer.concat(buffers).toString();
                    try {
                      body = JSON.parse(data);
                    } catch (e) {
                      body = data;
                    }
                  }

                  const vercelReq = {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body,
                    query: Object.fromEntries(url.searchParams)
                  };

                  await handler(vercelReq, vercelRes);
                  return;
                }
              } catch (error: any) {
                console.error('API Middleware Error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
