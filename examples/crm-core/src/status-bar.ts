import { createSlot } from "create-slot"

/**
 * The runtime channel, and the one thing here that cannot be server-rendered.
 *
 * Whichever page is mounted contributes its own summary to the shell's status
 * bar. That is live tree state — no manifest can know it up front — so it
 * registers from an effect and appears after hydration. The factory owns its
 * store: importing this object is what shares the slot.
 */
export const StatusBar = createSlot()
