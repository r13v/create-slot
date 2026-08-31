// Prepends the "use client" directive to the two client entry files — and
// only to them. Bundling strips file-level directives, so the published
// bundle gets it back here, at the top of the file, where both the ESM and
// the CJS prologue accept it. Everything else in dist must stay directive-
// free: a "use client" on the core entry or on a shared chunk would turn the
// React-free half into client references under RSC bundlers.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, sep } from "node:path"

const DIRECTIVE = '"use client";\n'
const CLIENT_FILES = ["dist/index.js", "dist/index.cjs"]

for (const file of CLIENT_FILES) {
  const content = readFileSync(file, "utf8")

  if (!content.startsWith(DIRECTIVE)) {
    writeFileSync(file, DIRECTIVE + content)
  }
}

const failures = []

for (const file of walk("dist")) {
  // Stale v3 artifacts are checked BEFORE the extension filter: the old
  // declaration files (.d.ts/.d.cts) are exactly what the filter would skip.
  if (/create-slot\.(js|cjs|d\.ts|d\.cts)$/.test(file)) {
    failures.push(`${file}: stale v3 artifact survived the build`)

    continue
  }

  if (!/\.(js|cjs|mjs)$/.test(file)) {
    continue
  }

  const content = readFileSync(file, "utf8")
  const isClientEntry = CLIENT_FILES.includes(file)

  if (isClientEntry && !content.startsWith(DIRECTIVE)) {
    failures.push(`${file}: expected "use client" as the first line`)
  }

  if (!isClientEntry && content.includes('"use client"')) {
    failures.push(`${file}: must not carry the "use client" directive`)
  }
}

/** Recursive listing with the separators normalized to "/" on every OS. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).split(sep).join("/"))
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}
