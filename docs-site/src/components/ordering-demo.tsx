import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { OrderingDemoClient } from "./ordering-demo.client"

export const OrderingDemo = Object.assign(
  function OrderingDemo(): ReactElement {
    return <OrderingDemoClient />
  },
  {
    toMarkdown() {
      return markdownFallback(
        "The live ordering demo runs only in a browser. Declared contributions reorder as soon as a new Resolution ranks them; a façade fill keeps the order it was given on mount until it is remounted.",
        "docs-site/src/components/ordering-demo.client.tsx",
      )
    },
  },
)
