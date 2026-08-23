/** The email plugin's server half. See `pipeline.server.ts` for why it is one. */

export type EmailState = { signature: string; drafts: number }

export function loadEmailState(): EmailState {
  return {
    signature: "— Dana Whitfield, Northwind account team",
    drafts: 3,
  }
}
