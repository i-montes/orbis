export * from './root.js';

/**
 * Generate a unique ID using crypto.randomUUID()
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Returns SHA-256 hash of the content as hex string
 */
export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Basic text cleaning before vectorization
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')       // collapse multiple spaces
    .replace(/[\r\n]+/g, '\n') // collapse multiple newlines
    .toLowerCase();
}

/**
 * Simple delay promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format bytes to human readable string (e.g. 1.0 KB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get current Unix timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Returns days elapsed since a timestamp (ms) until now
 */
export function daysSince(timestamp: number): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (now() - timestamp) / msPerDay;
}
