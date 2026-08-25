"use client"

import { StatusBar } from "./split-slots"

/**
 * The target of `import("./telephony-plugin")`. A façade plugin is a module, so
 * the whole module moves into its own chunk — the fills with it.
 */
export default function TelephonyPlugin() {
  return (
    <StatusBar>
      <span>No active call</span>
    </StatusBar>
  )
}
