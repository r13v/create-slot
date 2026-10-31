import { readdir, readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)
const skipContentHash = "#vocs-content"
const runtimeMarker = 'data-cs-vocs-skip-link-base="true"'

if (isMain()) {
  await patchPublicRoot(process.env.BASE_PATH ?? "/")
}

async function patchPublicRoot(basePathValue) {
  const basePath = normalizeBasePath(basePathValue)

  if (basePath === "") {
    return
  }

  for (const file of await listHtmlFiles(publicRoot)) {
    const source = await readFile(file, "utf8")
    const output = fixSkipLinks(source, basePath)

    if (output !== source) {
      await writeFile(file, output)
    }
  }
}

function isMain() {
  return (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  )
}

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const child = new URL(entry.name, directory)

    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(new URL(`${entry.name}/`, directory))))
      continue
    }

    if (entry.isFile() && child.pathname.endsWith(".html")) {
      files.push(child)
    }
  }

  return files
}

export function fixSkipLinks(html, basePath) {
  let foundSkipLink = false
  const output = html.replace(
    /<a\b(?=[^>]*data-v-skip-to-content(?:="true")?)[^>]*>/g,
    (tag) => {
      foundSkipLink = true
      return tag.replace(/\bhref="([^"]*)"/, (_attribute, href) => {
        return `href="${prefixSkipHref(href, basePath)}"`
      })
    },
  )

  if (!foundSkipLink || output.includes(runtimeMarker)) {
    return output
  }

  return output.replace("</body>", `${runtimePatch(basePath)}</body>`)
}

function prefixSkipHref(href, basePath) {
  if (!href.startsWith("/") || !href.endsWith(skipContentHash)) {
    return href
  }

  if (
    href === `${basePath}${skipContentHash}` ||
    href.startsWith(`${basePath}/`)
  ) {
    return href
  }

  return `${basePath}${href}`
}

function runtimePatch(basePath) {
  return `<script ${runtimeMarker}>(()=>{const e=${inlineScriptJson(
    basePath,
  )},t="${skipContentHash}",n=()=>{for(const n of document.querySelectorAll("a[data-v-skip-to-content]")){const r=n.getAttribute("href");r&&r.startsWith("/")&&r.endsWith(t)&&r!==e+t&&!r.startsWith(e+"/")&&n.setAttribute("href",e+r)}};n();new MutationObserver(n).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["href"]})})();</script>`
}

export function normalizeBasePath(value) {
  const trimmed = value.trim()

  if (trimmed === "" || trimmed === "/") {
    return ""
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`
}

function inlineScriptJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    return scriptJsonEscapes[character]
  })
}

const scriptJsonEscapes = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
}
