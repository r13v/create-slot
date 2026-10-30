---
status: accepted
---

# The brand is the gate, the derived Resolution is the seam

4.0 settled the shape: the registry is a pure function over serializable data.
Reviewing it afterwards turned up three places where a load-bearing invariant
was written down but not enforced, and one defence built for a state the
library cannot reach.

**The erased component type could never be a gate.** `ErasedComponent` is
`ComponentType<never>`, which by contravariance accepts *every* component —
that is exactly what lets one graph hold every slot's contributions. It also
means a hand-written `Contribution` literal, carrying another slot's
component, type-checked. `slot.contribute()` was the only thing that checked
`Props`, and nothing made it the only way in. `Contribution` and `Override`
now carry phantom brands, so they are unforgeable; the brands cost nothing at
runtime, and `lib/core/erasure.ts` holds the casts that follow, so the
invariant is stated once instead of in a comment per call site.

**"It's userland" was a seam with nothing on it.** Four rejected ideas
(policies, inspector, validator, ordering groups) all resolve to "write a
function over `Resolution`; it is plain data". But `Resolution` carries two
invariants its type does not show — `slots` has no prototype, and `seq` is the
position *after* sorting — so the `.filter` the docs prescribe loses both
silently. Hosts do not read `seq` today, which is what makes it the kind of
defect that surfaces one release later. `filterResolution` rebuilds both; both
it and `resolvePlugins` go through one private `recordOf`, so a derived
Resolution is indistinguishable from a resolved one.

**Diagnostics had no severity and no way to be fatal.** Every defect printed
the same way, though a dropped contribution and a stale `disable` entry are
not the same event. `severity` draws the line at "is the graph still what the
manifests declared", and `assertNoDiagnostics` is the one line that makes the
errors fail a build. It also gives consumers something stable to branch on:
the `code` union grows in minor releases, so an exhaustive `switch` over it
was always a future compile error.

## Considered Options

- **Anchoring every context through `Symbol.for`, instead of removing the
  anchor** — rejected, and this reverses part of 4.0. The per-slot props
  context was anchored on the descriptor so two copies of the adapter in one
  bundle would still meet. But a host finds its provider through
  `ResolutionContext`, a plain module-level context: two copies already fail
  with "'SlotHost' rendered outside of 'SlotProvider'" before a props context
  is read. The defence protected the second step of a sequence whose first
  step is fatal. Anchoring all four contexts would have made it real, at the
  price of keeping a rule the build already guarantees (`splitting: true`,
  re-checked by the chunk-sharing smokes) in a second place. Removing it
  instead took the frozen-descriptor fallback registry and a hidden
  non-enumerable property on data the docs call pure with it.
- **A policy vocabulary in `ResolveOptions` (`limit`, `allow`, `deny`)** —
  rejected again, for ADR 0004's reasons. `filterResolution` is a constructor,
  not a vocabulary: the application still says what a policy means.
- **`assertNoDiagnostics` as userland** — rejected. The data was already
  public, so what remained was the formatting, and every consumer would write
  the same loop. A formatter over data the library produces is not a policy.
- **Making warnings throw too** — rejected. A stale `disable` entry leaves the
  graph exactly as declared; failing a build on it would punish the ordinary
  case of a catalog that varies by tenant. `resolution.diagnostics` is there
  for anyone who wants it stricter.

## Consequences

- `Contribution` and `Override` can no longer be built by hand. Reading them
  is unaffected, which is all any consumer did; the examples and the docs site
  needed no change.
- `Diagnostic` gained a required `severity`. Additive for anyone reading
  diagnostics; the dev reporter now splits `console.error` from
  `console.warn`.
- `peerDependencies` dropped `react-dom`, which `lib/` never imported, and
  narrowed `react` from `*` to `^18 || ^19` — `useSyncExternalStore` and
  `"use client"` were never going to work on 16.
- CI gained `npm run lint:package` (publint + attw). Behavioural tests cannot
  see a broken `exports` map or types that resolve to `any` from CJS; the
  package's whole premise is that boundary, so it is checked as published.
  node10 resolution is out of scope: it ignores `exports` entirely, so it can
  reach neither the `/core` subpath nor the `react-server` condition that
  subpath exists for.
- The negative type tests (`@ts-expect-error`) are now load-bearing in
  `npm run typecheck`, which already covers `lib/`. Removing `NoInfer` or the
  conditional `props` type fails the build, which no runtime test could catch.
