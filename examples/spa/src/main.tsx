import "crm-core/crm.css"
import "./spa.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./app"

const root = document.getElementById("root")

if (!root) {
  throw new Error("[crm] index.html has no #root to mount into")
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
