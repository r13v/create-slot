/**
 * A live demo cannot render into the Markdown/LLM output of a page, so each
 * demo describes itself there and points at its source instead.
 */
export function markdownFallback(description: string, sourcePath: string) {
  return [
    { type: "paragraph", children: [{ type: "text", value: description }] },
    {
      type: "paragraph",
      children: [
        { type: "text", value: "Source: " },
        {
          type: "link",
          url: `https://github.com/r13v/create-slot/blob/main/${sourcePath}`,
          children: [{ type: "text", value: sourcePath }],
        },
      ],
    },
  ]
}
