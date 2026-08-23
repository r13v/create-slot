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
        "The live registry demo runs only in a browser. Enabling a plugin adds its contributions to two hosts at once, one contribution reads its own plugin id, and the crash-test plugin shows what renderFailed and onError do when a contribution throws.",
        "docs-site/src/components/registry-demo.client.tsx",
      )
    },
  },
)
