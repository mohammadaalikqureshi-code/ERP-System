import apiClient from '@/api/client';

/**
 * Fetch a file from the API (with auth headers attached) and save it as PDF.
 *
 * Automatically handles relative API paths and triggers browser native download.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  // 1. Clean up duplicate /api/v1 prefix if passed
  const cleanUrl = url.replace(/^\/api\/v1/, '');

  try {
    const response = await apiClient.get(cleanUrl, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf, application/octet-stream, */*',
      },
    });

    const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);
  } catch (err: any) {
    // If blob request failed, attempt direct window open as fallback
    const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `/api/v1${cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`}`;
    window.open(fullUrl, '_blank');
  }
}
