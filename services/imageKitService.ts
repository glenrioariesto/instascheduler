/**
 * Service to handle file uploads to ImageKit.
 */

export const uploadFileToImageKit = async (
  file: File,
  publicKey: string,
  privateKey: string,
  urlEndpoint: string
): Promise<string> => {
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit configuration is missing. Please check your settings.");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name);
  formData.append('useUniqueFileName', 'true');

  // For client-side apps, usually you'd use a signature from a server.
  // However, since this is a private tool and the private key is provided,
  // we use Basic Auth (private_key as username, empty password).
  const authHeader = 'Basic ' + btoa(privateKey + ':');

  const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
    },
    body: formData,
  });

  const data = await response.json();

  if (data.error || !response.ok) {
    throw new Error(`ImageKit Upload Failed: ${data.message || (data.error ? data.error.message : 'Unknown error')}`);
  }

  return data.url; // This is the direct URL to the uploaded file
};
