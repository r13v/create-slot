"use client"

import { createSlot } from "create-slot"

/**
 * The slot the code-splitting recipes share. A plugin module that is loaded
 * lazily has to reach the slot without importing the shell, so the slot lives
 * in a module of its own.
 */
export const StatusBar = createSlot()
