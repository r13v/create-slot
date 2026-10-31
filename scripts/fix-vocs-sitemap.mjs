import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { normalizeBasePath } from "./fix-vocs-skip-links.mjs"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const basePath = process.env.BASE_PATH ?? "/"
  for (const name of ["sitemap.xml", "robots.txt"]) {
    const file = new URL(name, publicRoot)
    const source = await readFile(file, "utf8")
    const output = source.replace(
      /(<loc>|^Sitemap: )(https?:\/\/[^<\s]+)/gm,
      (_match, before, url) => `${before}${prefixSitemapUrl(url, basePath)}`,
    )
    if (output !== source) await writeFile(file, output)
  }
}

/** Vocs 2.12.0 omits basePath here, but already includes it in canonical URLs. */
export function prefixSitemapUrl(value, basePathValue) {
  const basePath = normalizeBasePath(basePathValue)
  const url = new URL(value)
  if (
    basePath !== "" &&
    url.pathname !== basePath &&
    !url.pathname.startsWith(`${basePath}/`)
  ) {
    url.pathname = `${basePath}${url.pathname}`
  }
  return url.href
}
