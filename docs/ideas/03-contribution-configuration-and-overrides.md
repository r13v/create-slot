# Конфигурация и overrides contributions

> Статус: **Закрыто в v4** (ADR 0004): `ResolveOptions.disable/{plugins,contributions}` + типизированные патчи `Slot.override` в `resolvePlugins`.

## Проблема

Приложение может включить или выключить плагин целиком, но не может адресно
настроить один contribution. Для удаления, замены или перемещения элемента
интегратору приходится менять исходный manifest либо делать fork плагина.

## Предложение

Добавить serializable-конфигурацию по полному contribution ID:

```tsx
<PluginProvider
  plugins={plugins}
  config={{
    "pricing/nav-link": {
      disabled: true,
      order: 30,
    },
  }}
>
  {children}
</PluginProvider>
```

Для замены кода использовать отдельную чистую функцию, потому что component
нельзя сериализовать:

```tsx
const configuredPlugins = overridePlugins(plugins, {
  "pricing/nav-link": {
    component: CustomPricingLink,
  },
})
```

Конфигурация применяется до построения slot index. Неизвестный ID получает
development-диагностику и не влияет на остальные contributions.

## Правила

- `disabled` полностью исключает contribution из index.
- `order` заменяет значение manifest, но не меняет его.
- Override возвращает новый manifest и не мутирует исходный.
- Несколько конфигураций одного ID не объединяются неявно: последнее полное
  значение заменяет предыдущее.
- Сервер и клиент должны получить одинаковую конфигурацию.

## Границы

- У contribution не появляется `when` callback с React hooks.
- Динамическая видимость внутри UI остаётся ответственностью компонента.
- Конфигурация не управляет state, lifecycle или загрузкой кода.

## Критерии готовности

- Contribution можно отключить, переместить и заменить без изменения плагина.
- Оставшиеся contributions сохраняют React identity.
- Одинаковые plugins и config дают одинаковый HTML и hydration tree.
- Неизвестные и повторяющиеся IDs имеют точную диагностику.
- Программные overrides полностью типизированы props соответствующего slot.
