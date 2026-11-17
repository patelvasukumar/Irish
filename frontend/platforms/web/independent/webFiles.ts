/** Web-only file helpers (use browser APIs that do not exist on phones). */

export function webDefaultApiUrl(): string {
  if (typeof window === 'undefined' || !window.location) return 'http://localhost:8000';
  const { protocol, hostname } = window.location;
  return `${protocol === 'https:' ? 'https:' : 'http:'}//${hostname || 'localhost'}:8000`;
}

/** Fetch the file as a Blob and trigger the browser "save file" behaviour. */
export async function webSaveDownload(url: string, fileName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}
