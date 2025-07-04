import { createSlot } from "../lib/create-slot"

export const Slots = {
  Menu: createSlot<{ n: number; inc: () => void }>(),
}
