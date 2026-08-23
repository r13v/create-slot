import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { SlotBasicsDemoClient } from "./slot-basics-demo.client"

export const SlotBasicsDemo = Object.assign(
  function SlotBasicsDemo(): ReactElement {
    return <SlotBasicsDemoClient />
  },
  {
    toMarkdown() {
      return markdownFallback(
        "The live sidebar demo runs only in a browser. Toggling a feature mounts a component that contributes a menu item to a host it never imports, and every item reads the host's own props.",
        "docs-site/src/components/slot-basics-demo.client.tsx",
      )
    },
  },
)
