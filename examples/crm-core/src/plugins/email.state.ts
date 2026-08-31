import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { EmailState } from "./email.server"

/** The slice, plain and importable from both halves of the plugin. */
export const emailSlice = createSlice({
  name: "email",
  initialState: { signature: "— sent from the CRM", drafts: 0 } as EmailState,
  reducers: {
    drafted: (state) => {
      state.drafts += 1
    },
    signatureChanged: (state, action: PayloadAction<string>) => {
      state.signature = action.payload
    },
  },
})

export const { drafted, signatureChanged } = emailSlice.actions
