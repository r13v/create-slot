"use client"

/**
 * The target of `import("./panel")`. Only this component is deferred. The
 * manifest that declares it stays in the initial bundle.
 */
export default function DealPanel({ dealId }: { dealId: string }) {
  return <section>Notes for {dealId}</section>
}
