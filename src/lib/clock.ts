/**
 * Request-time clock reads for server components. Kept out of component
 * bodies so the React purity lint doesn't flag per-request time math.
 */
export function nowMs(): number {
  return Date.now();
}

export function isoOffsetFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
