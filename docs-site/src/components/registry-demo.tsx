import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { RegistryDemoClient } from "./registry-demo.client"

export const RegistryDemo = Object.assign(
  function RegistryDemo(): ReactElement {
    return <RegistryDemoClient />
  },
  {
    toMarkdown() {
      return markdownFallback(
        "The live registry demo runs only in a browser. Enabling a plugin resolves a new graph and both hosts pick it up at once, one contribution reads its own identity through useContribution, and the crash-test plugin shows what Failed and onError do when a contribution throws.",
        "docs-site/src/components/registry-demo.client.tsx",
      )
    },
  },
)
