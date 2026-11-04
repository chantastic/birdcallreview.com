/** Shareable episode times. Canonical form is `#t=MM:SS`. */

export function hashFor(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

/** Clock label without a leading zero on the minutes, so 9 seconds is `0:09`. */
export function labelFor(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

/** `#t=12:34`, `?t=754`, and `?t=12m34s`. Returns seconds, or null when the token is not a time. */
export function parseTimeToken(token: string): number | null {
  const value = token.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const clock = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const hours = clock[1] ? Number(clock[1]) : 0;
    const minutes = Number(clock[2]);
    const seconds = Number(clock[3]);
    if (seconds > 59 || (clock[1] && minutes > 59)) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }
  const words = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)$/i);
  if (words && (words[1] || words[2] || words[3])) {
    return Number(words[1] || 0) * 3600 + Number(words[2] || 0) * 60 + Number(words[3] || 0);
  }
  return null;
}

export function timeFromUrl(url: URL): number | null {
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (hash.startsWith('t=')) {
    const fromHash = parseTimeToken(decodeURIComponent(hash.slice(2)));
    if (fromHash != null) return fromHash;
  }
  const query = url.searchParams.get('t');
  if (query) return parseTimeToken(query);
  return null;
}

/** Absolute URL for one moment. Drops a `t` query so the shared form is the hash. */
export function momentUrl(pageUrl: string, episodePath: string, totalSeconds: number): string {
  const url = new URL(pageUrl);
  url.pathname = episodePath.startsWith('/') ? episodePath : `/${episodePath}`;
  url.searchParams.delete('t');
  url.hash = `t=${hashFor(totalSeconds)}`;
  return url.toString();
}
