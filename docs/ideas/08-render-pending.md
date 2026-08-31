# Общий pending UI для contributions

> Статус: **Закрыто в v4** (ADR 0004): `Pending`/`Failed` — компонентные пропсы `SlotProvider`; дефолт fallback=null сохранён.

## Проблема

Host изолирует каждый declarative contribution с помощью `Suspense`, но
использует `fallback={null}`. Автор contribution может добавить собственный
fallback, однако приложение не может задать единый pending UI для стороннего
плагина, который оно не контролирует.

## Предложение

Добавить handler в `PluginProvider`:

```tsx
<PluginProvider
  plugins={plugins}
  renderPending={({ pluginId, contributionId, slot }) => (
    <ContributionSkeleton slot={slot} />
  )}
>
  {children}
</PluginProvider>
```

Handler используется как fallback внешней `Suspense` boundary declarative
contribution. Вложенная boundary автора остаётся ближайшей и имеет приоритет.
Если handler не передан, fallback остаётся `null`.

## Семантика каналов

`renderPending` применяется только к declarative channel, где известны plugin и
contribution ID. Runtime fill остаётся кодом приложения и сам отвечает за
видимый pending UI; его защитная boundary продолжает использовать `null`.

## Границы

- Библиотека не добавляет собственный loader или preload API.
- `React.lazy`, `next/dynamic` и framework chunk registration остаются без
  изменений.
- Pending и failed states имеют разные handlers.
- Handler не получает host props или внутреннее состояние contribution.

## Критерии готовности

- Отсутствие `renderPending` полностью сохраняет текущее поведение.
- Client render и streaming SSR показывают заданный fallback.
- Hydration не получает mismatch при одинаковом plugin set.
- Новый inline handler не перестраивает slot index и не перерисовывает все
  hosts.
- Собственная `Suspense` boundary contribution продолжает управлять своим
  fallback.
