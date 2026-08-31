# Группы и политика порядка

> Статус: **Отклонено** (ADR 0004): числовой `order` + `renderEntries` (партиционирование на стороне приложения) покрывают сценарий без второго словаря порядка.

## Проблема

Одного числового `order` достаточно внутри одного репозитория, но независимым
plugin packages приходится договариваться о диапазонах чисел. Относительные
ссылки `before` и `after` создают прямые зависимости между plugins, ошибки при
отсутствующих целях и циклы.

## Предложение

Добавить необязательную группу contribution:

```tsx
Nav.contribute({
  id: "pricing-link",
  group: "primary",
  order: 20,
  component: PricingLink,
})
```

Порядок групп принадлежит host или приложению:

```tsx
<PluginProvider
  ordering={{
    "acme/navigation/v1": ["primary", "secondary", "support"],
  }}
/>
```

Сначала сравнивается позиция group, затем текущий числовой `order`, затем
стабильный tie-break канала. Contribution без group попадает в `default`.

Специализированный host может переопределить сортировку через host-controlled
rendering, не меняя manifest.

## Правила

- Group является частью контракта конкретного slot, а не глобальным словарём.
- Неизвестная group не исчезает: она рендерится после известных и получает
  development-предупреждение.
- App config может изменить group и order по contribution ID.
- Declarative contribution остаётся раньше runtime fill при полном равенстве.

## Границы

- API не поддерживает `before` и `after` между plugins.
- Библиотека не приписывает группам presentation или permissions.
- Без ordering config поведение существующего числового `order` не меняется.

## Критерии готовности

- Порядок не зависит от случайного выбора числовых диапазонов разными plugins.
- Unknown и duplicate group definitions имеют точную диагностику.
- SSR, hydration и client updates используют один resolver.
- Изменение group через config не перемонтирует contribution со стабильным ID.
- Приложение может сохранить старое поведение без миграции manifests.
