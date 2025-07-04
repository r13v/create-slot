import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./app.tsx"
import { FeatureC } from "./feature-c.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App>
      <FeatureC />
    </App>
  </StrictMode>,
)
