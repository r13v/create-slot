# Каталог плагинов для SSR и RSC

> Статус: **Отклонено** (ADR 0004): userland-паттерн `satisfies Record<Id, Plugin>` уже покрывает задачу (см. examples/crm-core/src/catalog.ts); non-goal REGISTRY.md.

## Проблема

При SSR сервер и клиент обязаны выбрать одинаковые плагины в одинаковом порядке.
Сейчас приложение вручную хранит ordered-список IDs, сопоставляет их manifests,
фильтрует enabled set и стабилизирует итоговый массив. Эта логика легко
расходится между server seam и client boundary.

## Предложение

Добавить каталог, который связывает server-safe список IDs с client manifests:

```ts
// server-safe module
export const INSTALLED_PLUGIN_IDS = definePluginIds([
  "pipeline",
  "forecast",
  "pricing",
] as const)
```

```tsx
// client graph
export const catalog = createPluginCatalog(INSTALLED_PLUGIN_IDS, {
  pipeline,
  forecast,
  pricing,
})

const plugins = catalog.resolve(enabledIds)
```

`resolve` всегда возвращает плагины в порядке installed catalog, независимо от
порядка входных IDs. Повторные IDs удаляются. Неизвестные IDs игнорируются и
передаются в диагностический callback.

Каталог также предоставляет `ids` и описание resolved set без импорта React
components в server graph.

## Правила

- Record manifests должен содержать каждый installed ID ровно один раз.
- Enabled set не может изменить канонический порядок.
- Одинаковый нормализованный set должен давать стабильную ссылку на массив.
- Каталог не загружает manifests удалённо и не определяет feature flags.
- Решение о включении плагина остаётся у приложения.

## Границы

- Manifest с components остаётся в client graph.
- Каталог не скрывает требование передать серверу и клиенту одинаковые IDs.
- State preload, loaders и server capabilities не становятся частью core API.

## Критерии готовности

- TypeScript проверяет полноту и отсутствие лишних manifest keys.
- Unknown и duplicate IDs имеют детерминированное поведение.
- Resolve не меняет порядок из-за порядка пользовательского ввода.
- Повторный resolve одного set не заставляет `PluginProvider` перестраивать
  index.
- Есть пример для Next.js App Router с передачей только IDs через client
  boundary.
