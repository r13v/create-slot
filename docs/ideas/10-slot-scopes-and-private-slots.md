# Области видимости и private slots

> Статус: **Частично закрыто в v4** (ADR 0004): per-factory store фасада даёт изоляцию, о которой просили scopes; scope-контекст и private tokens отклонены — контекст не пересекает копии пакета, а изоляция по identity уже есть у `createSlot()`.

## Проблема

Declarative contributions ограничены ближайшим `PluginProvider`, а runtime
fills хранятся в module-level store по имени slot и намеренно доступны разным
React roots. Это удобно для одного приложения, но два embedded apps,
microfrontends или параллельные тесты могут случайно обменяться fills с
одинаковыми именами.

Публичная строка также не подходит для slot, который должен быть доступен
только одному модулю.

## Предложение

Добавить явный runtime scope:

```tsx
const scope = createSlotScope()

rootA.render(
  <SlotScopeProvider scope={scope}>
    <Feature />
  </SlotScopeProvider>,
)

rootB.render(
  <SlotScopeProvider scope={scope}>
    <Layout />
  </SlotScopeProvider>,
)
```

Один scope сохраняет cross-root delivery. Разные scopes полностью изолированы.
Без provider используется существующий global scope.

Для внутренних контрактов добавить непрозрачный token:

```tsx
const InternalToolbar = defineSlot<ToolbarProps>(
  createPrivateSlotId("internal-toolbar"),
)
```

Token имеет диагностическое имя, но сопоставляется по identity. Публичные slots
продолжают использовать versioned string IDs.

## Границы

- Scope не переносит contributions между разными загруженными копиями пакета
  автоматически.
- Private token нельзя сериализовать или адресовать из удалённого manifest.
- Declarative provider scoping не меняется.
- Global scope остаётся default для обратной совместимости.

## Критерии готовности

- Одинаковое имя в разных scopes не смешивает runtime entries.
- Один явно переданный scope работает между несколькими React roots.
- Поведение без `SlotScopeProvider` совпадает с текущим.
- Server snapshot runtime channel всегда остаётся пустым.
- После unmount scope освобождает fills, snapshots и listeners.
