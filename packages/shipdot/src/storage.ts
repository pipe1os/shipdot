/** Maximum number of read IDs kept per storage key. */
export const MAX_IDS = 500

/**
 * Read entry IDs, or undefined on a first visit or when storage is unavailable
 * (private mode, disabled cookies, sandboxed iframes…).
 */
export function readIds(key: string): string[] | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : undefined
  } catch {
    return undefined
  }
}

export function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-MAX_IDS)))
  } catch {
    // Quota exceeded or storage disabled: read state stays in memory.
  }
}
