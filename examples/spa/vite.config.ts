import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // `crm-core` is a linked workspace package, so Vite compiles it from source.
  // React has to stay a single copy across it, the app and the library.
  resolve: { dedupe: ["react", "react-dom"] },
})
