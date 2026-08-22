import apiClient from '@/api/client';

/**
 * Fetch a file from the API (with auth headers attached) and save it.
 *
 * A plain `<a href>` cannot be used for these endpoints because they require
 * the Authorization header, so we download the blob and hand it to the browser.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await apiClient.get(url, { responseType: 'blob' });

  const blobUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
