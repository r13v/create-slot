// Runs under `node --conditions react-server` (see the test:rsc script).
//
// Two assertions pin the server/client boundary from both sides through the
// package's own exports map (self-reference specifiers, not file paths):
// the React-free core must load in a server graph, and the "use client"
// entry must refuse to — which also proves the condition actually flowed.
import { readFileSync } from "node:fs"

const core = await import("create-slot/core")

if (typeof core.resolvePlugins !== "function") {
  console.error("create-slot/core loaded but resolvePlugins is missing")
  process.exit(1)
}

let clientError = null

try {
  await import("create-slot")
} catch (error) {
  clientError = error
}

if (clientError === null) {
  console.error(
    "create-slot (client entry) loaded under react-server — the boundary leaks",
  )
  process.exit(1)
}

// The refusal must be the RIGHT refusal: the react-server build of react
// lacks the client APIs the entry imports. Any other error — a missing
// chunk, a broken exports map — means the client entry is broken everywhere,
// which this smoke must not bless as "ok".
if (!/react/i.test(String(clientError))) {
  console.error(
    `create-slot failed to load for the wrong reason: ${String(clientError)}`,
  )
  process.exit(1)
}

// And the static half: nothing reachable from the core entries may import
// react at runtime — subpaths like react/jsx-runtime included. With
// splitting enabled the core's actual code lives in shared chunks, so the
// scan follows the entries' chunk imports instead of trusting a directory.
const REACT_IMPORT =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']react(?:\/[^"']+)?["']/

const queue = ["dist/core/index.js", "dist/core/index.cjs"]
const seen = new Set()
const offenders = []

while (queue.length > 0) {
  const file = queue.pop()

  if (file === undefined || seen.has(file)) {
    continue
  }

  seen.add(file)

  const content = readFileSync(file, "utf8")

  if (REACT_IMPORT.test(content)) {
    offenders.push(file)
  }

  for (const match of content.matchAll(
    /(?:from\s*|require\s*\(\s*)["'](\.[^"']+)["']/g,
  )) {
    queue.push(new URL(match[1], `file:///${file}`).pathname.slice(1))
  }
}

if (offenders.length > 0) {
  console.error(
    `react reachable from create-slot/core at runtime: ${offenders.join(", ")}`,
  )
  process.exit(1)
}

console.log("react-server smoke: ok")
