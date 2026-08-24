/**
 * The slow query behind this example's own plugin.
 *
 * Server-only in practice, but it imports nothing server-only, so the client can
 * still `import type { Insight }`. The delay is what makes streaming visible:
 * the shell is flushed long before this resolves.
 */

export type Insight = { quota: number; attained: number }

export async function loadInsight(): Promise<Insight> {
  await new Promise((resolve) => setTimeout(resolve, 1200))

  return { quota: 1_000_000, attained: 780_000 }
}
