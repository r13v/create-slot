/**
 * The pipeline plugin's server half.
 *
 * It is a separate module for one reason: a React Server Component may import
 * this, and it may not import `pipeline.tsx` — that file reaches the slots, and
 * `defineSlot` uses `createContext`, which does not exist in the `react-server`
 * build of React. So everything the server has to read lives here, and the
 * manifest points at it.
 */

export type PipelineState = { quarterTarget: number }

/** As if it came from the organisation's settings row. */
export function loadPipelineState(): PipelineState {
  return { quarterTarget: 400_000 }
}
