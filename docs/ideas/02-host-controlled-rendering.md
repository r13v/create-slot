# Управляемый host рендеринг

> Статус: **Закрыто в v4** (ADR 0004): `SlotHost renderEntries={...}` — escape hatch с метаданными; дефолтный рендер реализован через тот же путь.

## Проблема

Сейчас `Host` сам выводит contributions подряд. Внешняя DOM-структура поэтому
часто оказывается частью неявного контракта: плагин должен знать, что ему нужно
вернуть `li`, toolbar item или grid cell. Host не может единообразно добавить
обёртки, разделители, responsive layout или accessibility-атрибуты.

## Предложение

Дать slot возможность создавать специализированный host с функцией рендера:

```tsx
const NavHost = Nav.createHost(({ items, fallback }) => (
  <ul>
    {items.length > 0
      ? items.map(({ key, node, pluginId }) => (
          <li key={key} data-plugin={pluginId}>
            {node}
          </li>
        ))
      : fallback}
  </ul>
))

;<NavHost current={route}>Нет доступных разделов</NavHost>
```

Каждый item содержит готовый изолированный `ReactNode` и безопасную metadata:

```ts
type HostItem = {
  key: string
  contributionId: string | null
  pluginId: string | null
  channel: "declarative" | "runtime"
  order: number
  node: ReactNode
}
```

Обычный `slot.Host` сохраняет текущее поведение. `createHost` нужен только там,
где presentation должен принадлежать приложению.

## Границы

- Host не получает исходный component и не отвечает за его вызов.
- Error boundary, `Suspense`, plugin context и memoization остаются внутри
  `node`.
- Metadata не содержит props или произвольные данные компонента.
- Функция рендера не меняет набор contributions; фильтрация относится к
  политикам slot.

## Критерии готовности

- Пользовательский host работает с обоими каналами и при SSR.
- Ошибка или suspension одного item не ломает остальные.
- Placeholder доступен функции рендера и появляется только при пустом наборе.
- Одинаковый contribution не перемонтируется при смене внешней layout-разметки.
- Существующий `Host` не меняет API и поведение.
