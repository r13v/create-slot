---
status: accepted
---

# The façade keeps its published names; the registry carries the canonical language

3.0 rebuilt the library as a plugin registry, so every role got a name twice:
`createSlot`'s published surface calls its contributor `Slot`, while the
registry calls the same thing `Fill`. The registry had not shipped yet, so its
names were renamed freely to one canonical vocabulary — `Slot` for the extension
point, `Host`, `Contribution`, `Fill`, declarative and runtime channels — and the
five names 2.2.1 published (`createSlot`, `Slot`, `Slot.Host`, `Slot.useProps`,
type `Slot<Props>`) were left untouched. Two vocabularies in one package is the
accepted price of not breaking existing imports.

## Considered Options

- **Deprecated aliases in the registry** — would have carried compatibility
  shims for an API no release had ever exposed.
- **A clean break in 4.0** — a major version spent on renames alone, and a
  second migration for users who had just moved to 3.0.
- **A `Slot.Fill` alias on the façade** — two spellings of the same component
  forever, since the façade's `Slot` already _is_ the fill.

## Consequences

The façade's own words are frozen, so its docs and JSDoc read in the older
language on purpose; README stays in 2.x terms and the canonical glossary lives
in `CONTEXT.md` and `REGISTRY.md`. `createSlot` carries no `@deprecated` marker:
3.0 already changes its `order` semantics, and pushing users onto an API with no
releases behind it would be worse. Once 3.0 ships, the registry's names are
frozen on the same terms as the façade's.
