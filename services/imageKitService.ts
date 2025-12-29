/**
 * Service to handle file uploads to ImageKit.
 */

export const uploadFileToImageKit = async (
  file: File,
  publicKey: string,
  privateKey: string,
  urlEndpoint: string
): Promise<string> => {
  if (!publicKey || !urlEndpoint) {
    throw new Error("ImageKit configuration (Public Key or URL Endpoint) is missing.");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name);
  formData.append('useUniqueFileName', 'true');
  formData.append('publicKey', publicKey);

  const headers: Record<string, string> = {};

  // If privateKey is provided, use Basic Auth (legacy/private tool approach)
  // If not, it assumes Unsigned Upload is enabled in ImageKit dashboard
  if (privateKey) {
    headers['Authorization'] = 'Basic ' + btoa(privateKey + ':');
  }

  const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();

  if (data.error || !response.ok) {
    throw new Error(`ImageKit Upload Failed: ${data.message || (data.error ? data.error.message : 'Unknown error')}`);
  }

  return data.url; // This is the direct URL to the uploaded file
};
