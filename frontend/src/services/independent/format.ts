/** Small pure formatting helpers. */

export function formatDate(iso?: string | null, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function place(city?: string | null, province?: string | null): string {
  return [city, province].filter(Boolean).join(', ');
}

/** "Python, SQL ,  Git" -> ["Python","SQL","Git"] */
export function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidUrl(value: string): boolean {
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());
}

export function safeFileName(value: string, fallback = 'resume'): string {
  const cleaned = value.replace(/[^A-Za-z0-9 _.-]/g, '').trim().replace(/\s+/g, '_');
  return cleaned.slice(0, 80) || fallback;
}
