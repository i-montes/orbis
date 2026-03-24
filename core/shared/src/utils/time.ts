export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

/** Alias for getCurrentTimestamp */
export const now = getCurrentTimestamp;

/**
 * Returns the number of days between now and the given timestamp.
 */
export function daysSince(timestamp: number): number {
  const diffMs = Date.now() - timestamp;
  return diffMs / (1000 * 60 * 60 * 24);
}
