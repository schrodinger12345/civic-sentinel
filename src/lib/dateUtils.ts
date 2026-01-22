/**
 * Normalize mixed date formats from Firestore/API into JS Date
 * Handles: ISO strings, Firestore Timestamps, Date objects, null/undefined
 */
export function normalizeDate(input: any): Date | null {
  if (!input) return null;

  if (input instanceof Date) return input;

  if (typeof input === 'string') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore Timestamp { seconds, nanoseconds }
  if (typeof input === 'object' && typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }

  // Firestore Timestamp { _seconds, _nanoseconds }
  if (typeof input === 'object' && typeof input._seconds === 'number') {
    return new Date(input._seconds * 1000);
  }

  return null;
}

/**
 * Safe date formatting that never throws or returns "Invalid Date"
 */
export function formatDate(input: any, fallback: string = 'Date unavailable'): string {
  const date = normalizeDate(input);
  if (!date) return fallback;

  try {
    return date.toLocaleString();
  } catch {
    return fallback;
  }
}

/**
 * Safe relative time formatting (e.g., "2 minutes ago")
 */
export function formatRelativeTime(input: any): string {
  const date = normalizeDate(input);
  if (!date) return 'Unknown time';

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(Math.abs(diff) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
