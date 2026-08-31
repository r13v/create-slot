# Валидатор и snapshot plugin graph

> Статус: **Частично закрыто в v4** (ADR 0004): диагностики резолвера покрывают детерминированные проверки; snapshot/testing-entry — userland над `Resolution`.

## Проблема

Большинство ошибок manifests детерминированы до запуска React: повторяющиеся
IDs, неизвестные overrides, несовместимые версии slot и нарушения policies.
Сейчас они обнаруживаются в браузере либо проверяются самописными тестами
приложения.

## Предложение

Добавить чистые функции в `create-slot/testing`:

```ts
const report = validateCatalog({
  slots,
  plugins,
  config,
  policies,
})

expect(report.errors).toEqual([])
expect(describePluginGraph(report.graph)).toMatchSnapshot()
```

Validator использует тот же resolver, что и `PluginProvider`, но не запускает
React и не рендерит components.

## Проверки

- duplicate plugin и contribution IDs;
- неизвестный slot, override или config target;
- несовместимая major-версия slot contract;
- нарушение cardinality, allowlist и limits;
- contribution без стабильного ID в режиме строгой миграции;
- неоднозначная или отсутствующая ordering group.

Snapshot содержит только JSON-совместимую metadata: IDs, slot, channel,
effective order, policy result и причину отклонения. Component identity и
исходный код в него не входят.

## Границы

- Пакет не зависит от Jest или Vitest.
- Валидатор не выполняет components, hooks, loaders и пользовательские
  predicates.
- TypeScript-несовместимость props по-прежнему проверяет компилятор.
- Snapshot не заменяет тест фактического HTML и hydration.

## Критерии готовности

- Один manifest даёт одинаковый report в Node и браузере.
- Runtime resolver и validator используют общие правила, а не две реализации.
- Сообщение каждой ошибки содержит plugin, contribution и slot ID.
- Обновление порядка или состава graph даёт небольшой читаемый diff.
- `create-slot/testing` не попадает в production bundle приложения.
