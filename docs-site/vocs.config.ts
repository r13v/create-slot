import { fileURLToPath } from "node:url"
import { defineConfig } from "vocs/config"

const basePath = process.env.BASE_PATH ?? "/"
const assetBasePath = basePath.replace(/\/$/, "")

export default defineConfig({
  title: "create-slot",
  titleTemplate: "%s – create-slot",
  description:
    "A React plugin registry: features declare UI contributions, and the application renders them at named points without importing the features.",
  iconUrl: `${assetBasePath}/favicon.svg`,
  logoUrl: {
    light: `${assetBasePath}/create-slot-light.svg`,
    dark: `${assetBasePath}/create-slot-dark.svg`,
  },
  baseUrl: process.env.BASE_URL ?? "https://r13v.github.io",
  basePath,
  renderStrategy: "full-static",
  checkDeadlinks: true,
  accentColor: "light-dark(#6d33d6, #a78bfa)",
  codeHighlight: {
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  twoslash: {
    twoslashOptions: {
      // Snippets are included from `src/snippets`, so twoslash resolves
      // `create-slot` through this project's own `node_modules`.
      vfsRoot: fileURLToPath(new URL("./src/snippets", import.meta.url)),
      compilerOptions: {
        // `ts.JsxEmit.ReactJSX`, spelled as a literal: importing `typescript`
        // here bundles the whole compiler into the built config.
        jsx: 4,
        jsxImportSource: "react",
      },
    },
  },
  socials: [{ icon: "github", link: "https://github.com/r13v/create-slot" }],
  editLink: {
    link: "https://github.com/r13v/create-slot/edit/main/docs-site/:path",
    text: "Edit this page",
  },
  topNav: [
    { text: "Guide", link: "/get-started" },
    { text: "API", link: "/api" },
    {
      text: "npm",
      link: "https://www.npmjs.com/package/create-slot",
    },
  ],
  sidebar: [
    {
      text: "Start",
      collapsed: false,
      items: [
        { text: "Overview", link: "/" },
        { text: "Get started", link: "/get-started" },
        { text: "Slots, hosts & fills", link: "/slots" },
        { text: "Two channels", link: "/channels" },
        { text: "Use with AI agents", link: "/ai-agents" },
      ],
    },
    {
      text: "Guides",
      collapsed: false,
      items: [
        { text: "Plugin registry", link: "/registry" },
        { text: "Ordering", link: "/ordering" },
        { text: "Server rendering", link: "/server-rendering" },
        { text: "Failure isolation", link: "/failure-isolation" },
        { text: "Plugin state", link: "/state" },
        { text: "Performance", link: "/performance" },
        { text: "Recipes", link: "/recipes" },
      ],
    },
    {
      text: "Reference",
      collapsed: false,
      items: [
        { text: "API", link: "/api" },
        { text: "Errors", link: "/errors" },
        { text: "Examples", link: "/examples" },
        {
          text: "LLM documentation index",
          link: "https://r13v.github.io/create-slot/llms.txt",
        },
        {
          text: "Full documentation for LLMs",
          link: "https://r13v.github.io/create-slot/llms-full.txt",
        },
      ],
    },
    {
      text: "Help",
      collapsed: false,
      items: [
        { text: "FAQs", link: "/faqs" },
        { text: "Migrating to 3.0", link: "/migrating" },
      ],
    },
  ],
})
