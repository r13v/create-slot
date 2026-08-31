# create-slot v4 «Resolution Core»

> Ревизия 3: учтены находки plan-review (3 изолированных ревьюера, REVISE) и
> Codex-ревью (P1 — generic `entriesOf`; P2 — атомарность удаления v3 со сменой
> tsup-entry; P2 — `clean: true`; P2 — прототип-ключи в `Resolution.slots`).

## Overview

Полный редизайн публичного API (мажорный релиз 4.0.0). Реестр становится одной чистой
функцией над сериализуемыми данными; всё остальное — тонкий адаптер.

- **Проблема.** v3 несёт структурные дефекты: позиционные React-ключи
  `${pluginId}#${index}` (вставка contribution перемонтирует соседей), module-level
  runtime store (CJS dual-store, глобальная связность), асимметрия каналов (у fills нет
  идентичности → политики/конфиг/группы нереализуемы когерентно), `PluginProvider`
  владеет мемоизацией индекса (инлайновые пропсы = ловушки), отсутствие RSC-истории.
- **Решение.** Пакет раскалывается на два entry:
  - `create-slot/core` — React-free данные: `defineSlot`, `definePlugin`,
    `resolvePlugins(plugins, options) -> Resolution` (чистая, синхронная,
    детерминированная), `entriesOf`. Импортируется из server components, Node и тестов.
  - `create-slot` — `"use client"` адаптер: `SlotProvider`, `SlotHost`,
    `ContributionBoundary`, хуки — плюс source-compatible фасад `createSlot()`.
  - Runtime-канал **целиком изгнан в фасад**: каждая фабрика `createSlot()` владеет
    собственным closure-store и context. В реестре ровно один (декларативный) канал.
- **Интеграция.** Декларативные API v3 (`defineSlot` с членами Host/Fill,
  `PluginProvider plugins=`) заменяются без слоя совместимости. Фасад `createSlot`
  сохраняет все четыре runtime-формы использования v3 (`<S order>`, `<S.Host>`,
  `S.useProps()`, placeholder-children); его **тип** `Slot<Props>` переименовывается в
  `RuntimeSlot<Props>` — имя `Slot` отходит дескриптору слота (решение владельца,
  type-level break, громкие release notes).

**Acceptance criteria:**

1. Smoke под `node --conditions react-server`: `import("create-slot/core")` (по
   self-reference specifier, через exports map — не по file-пути) успешен, а
   `import("create-slot")` (клиентский entry) **падает**. Дополнительно: в
   `dist/core/` нет runtime-импортов `react` (grep).
2. Все четыре runtime-формы фасада v3 проходят существующие поведенческие тесты
   `lib/create-slot.test.tsx` без изменения runtime-кода тестов (правки
   import-строк — пути модулей и type-импорты — допустимы).
3. `npm run lint && npm run typecheck && npm run test:run && npm run knip && npm run
   bundle && npm pack --dry-run` — зелёные.
4. `npm run build:examples` и `npm run site:build` — зелёные; пример `nextjs-app`
   демонстрирует передачу `Resolution` через RSC-границу из server layout И полностью
   серверный host через `entriesOf` + `ContributionBoundary`.
5. Perf-бюджеты: инлайновые handlers на `SlotProvider` → 0 обновлений contributions;
   инлайновый `resolvePlugins()` при каждом рендере → 0 обновлений contributions
   (перерисовываются только тонкие shell-обёртки).
6. Резолвер возвращает диагностики (не бросает) для: duplicate-plugin-id,
   duplicate-contribution-id, invalid-contribution-id, unknown-disable-target,
   unknown-override-target, override-slot-mismatch. В dev они `console.error`-ятся по
   паттерну module-level NODE_ENV-conditional-const (как v3 `lib/provider.tsx:59`),
   с дедупликацией по содержимому (инлайновый `resolvePlugins()` не должен флудить
   консоль каждый рендер).
7. Сборка (один tsup-конфиг, `splitting: true`): оба entry делят общие чанки —
   smoke импортирует оба entry в одном CJS-процессе и проверяет `Object.is` на общем
   символе; `dist/index.js` и `dist/index.cjs` начинаются с `"use client"` (первая
   строка, валидная позиция пролога); core-артефакты и чанки директивы НЕ содержат.

## Context

- **Библиотека:** `lib/` (~1000 LOC): `create-slot.tsx` (фасад), `slot.tsx`
  (buildSlot/Host/IsolatedContribution/isolate/useStableProps/merge), `provider.tsx`
  (PluginProvider/buildIndex/два контекста), `plugin.ts`, `runtime.ts`
  (module-level RuntimeStore, useSyncExternalStore, getServerSnapshot=EMPTY),
  `error-boundary.tsx`. Тесты рядом: `create-slot.test.tsx`, `registry.test.tsx`
  (~1500 строк, ~50 кейсов — самое плотное покрытие), `runtime-store.test.tsx`,
  `ssr.test.tsx`, `streaming.test.tsx`, `perf.test.tsx` (бюджеты обновлений host),
  `perf.bench.tsx`. Общий сетап: `test/setup-tests.ts` (afterEach-ассерт
  `trackedSlots() === {entries:0,snapshots:0,listeners:0}` по глобальному стору v3).
  ВНИМАНИЕ: `vite.config.ts` включает только `lib/**/*.test.tsx` — `.test.ts` файлы
  невидимы без правки include.
- **Сборка:** tsup 8.5.1 (конфиг в `package.json`, один entry `lib/create-slot.tsx`,
  ESM+CJS+dts, `sideEffects:false`, `sourcemap:true`). Эмпирически проверено на
  8.5.1: (а) `banner` в одном конфиге попадает на ВСЕ файлы, включая core и чанки;
  (б) массив из двух конфигов НЕ делит чанки между entry; (в) в CJS `banner`
  оказывается после `"use strict"`-преамбулы (директива вне пролога инертна).
  Поэтому директива добавляется post-build скриптом (см. Task 7). Top-level
  `"types": "./dist/create-slot.d.ts"` (`package.json:24`) станет висячим — обновить.
  Линт/формат — biome; мёртвый код — knip (`knip.json`, `paths` мапит `create-slot` →
  `./lib/create-slot.tsx`); CI — `.github/workflows/ci.yml`
  (lint→typecheck→test→knip→bundle→pack dry-run); `publish.yml` повторяет проверки
  перед публикацией; `pages.yml` деплоит docs-site на КАЖДЫЙ push в main. Релизы —
  release-please (conventional commits; `feat!:` даст 4.0.0; manifest 3.1.0).
- **Примеры (workspaces):** `examples/crm-core` (slots.ts, plugin.ts, catalog.ts,
  runtime.tsx, views.tsx, server.ts, state.ts, ui.tsx, plugins/{pipeline,forecast,
  email,telephony}.tsx, plugins/{pipeline,email}.server.ts), `examples/spa`,
  `examples/nextjs-pages`, `examples/nextjs-app`. `state.ts:2` и `ui.tsx:1`
  импортируют `usePluginId`; `plugins/*.server.ts` библиотеку НЕ импортируют
  (проверено) — кода не требуют. `crm-spa` гоняет `tsc --noEmit` по исходникам
  crm-core. Vocs (docs-site) типочекает сниппеты против собранного пакета
  (`vocs.config.ts` vfsRoot) — список сниппетов энфорсится `site:build`;
  `panel.tsx` и `telephony-plugin.tsx` используют только фасадные формы, переживающие
  v4 без правок.
- **Документация:** `CONTEXT.md` (словарь), `REGISTRY.md` (rationale + non-goals),
  `README.md`, `docs/ARCHITECTURE.md`, `docs/adr/0001..0003` (все три противоречат
  v4 и требуют статус-правок — см. Task 9), `docs/ideas/01..10` (вердикты — в
  таблице Review Handoff).
- **Механики v3, переносимые дословно:** `isolate()` — WeakMap-кэш `memo`-обёртки по
  identity компонента; `useStableProps` — удержание пропсов по value-compare
  (безопасно к discarded renders); раздельные контексты для данных и handlers;
  dev-диагностика через module-level NODE_ENV-conditional-const; фасадный store —
  `getServerSnapshot` всегда EMPTY, регистрация в layout-effect, unmount-only cleanup.

## Review Handoff

- **Исходный запрос:** полный редизайн API v4; сохранить только фасад `createSlot`
  (SPA-вариант); рекомендованный подход выбран по итогам исследования аналогов
  (VS Code, Theia, Backstage, Grafana, Piral, Gutenberg SlotFill, Payload CMS) и
  судейского отбора из трёх независимых дизайнов; план прошёл plan-review, правки
  внесены.
- **Ключевые решения:**
  - Реестр декларативный и одноканальный; runtime-канал только в фасаде,
    per-factory closure store (module-level store удаляется).
  - id contribution обязателен: `contribute(id, spec)`; ключ/адрес —
    `${pluginId}/${contributionId}`; id без `/`, непустой, уникален в пределах плагина.
  - `resolvePlugins` — чистая функция в React-free core; приложение владеет
    мемоизацией (module scope / useMemo); провайдер принимает готовый `Resolution`.
  - `Resolution.slots` — `Readonly<Record<string, readonly ResolvedEntry[]>>`:
    надёжнее Map при сериализации через RSC-границу, удобен userland-обходам.
    ВАЖНО: «JSON-дамп» возможен только для метаданных — `component` это
    функция/client reference и JSON round-trip невозможен; тестов на JSON
    round-trip Resolution не писать.
  - Один options bag: `disable: {plugins?, contributions?}` + `overrides`
    (типизированные патчи `Slot.override`).
  - Диагностики возвращаются, никогда не бросаются; в dev логируются с
    дедупликацией по содержимому; ничего не отбрасывается тихо.
  - `SlotHost`: явный bag `props={...}` (не spread); `children` — placeholder;
    `renderEntries` — escape hatch, дефолтный рендер реализован ЧЕРЕЗ него.
  - Провайдер: `onError` (колбэк) + `Failed`/`Pending` — КОМПОНЕНТНЫЕ пропсы,
    не render-функции. Handlers — в отдельном value-changing memo-контексте
    (НЕ latest-ref: render output не должен жить в ref).
  - Мемоизация contribution — content-based comparator (key, pluginId,
    contributionId, order, component по identity) + value-held props; внутренний
    слой `isolate()` (WeakMap по identity компонента) сохраняется.
  - Per-slot props-context живёт НА ДЕСКРИПТОРЕ: лениво создаётся адаптером и
    кэшируется на объекте под ключом `Symbol.for("create-slot.props-context")`,
    идемпотентно (StrictMode/discarded renders). НЕ module-level WeakMap адаптера —
    ESM+CJS копии адаптера дали бы два WeakMap и `useSlotProps` → null (тот самый
    dual-copy класс дефектов, который v4 устраняет). React — peer, идентичность
    контекста общая.
  - `useContribution(): {slot, pluginId, contributionId}` вместо `usePluginId`.
  - Имя `Slot<Props>` — дескриптору из `defineSlot`; фасадный тип → `RuntimeSlot`.
  - Методы `Slot<Props>` объявляются property-style (`contribute: (id, spec) =>
    Contribution`), не method-style — строгая вариантность, несовместимые
    дескрипторы не проходят тихо.
  - RSC — два честных tier'а без кодогенерации: tier 1 — реестр за одной клиентской
    границей; tier 2 — «two-module discipline» (манифест — обычный модуль,
    импортирующий компоненты из "use client" файлов) и `Resolution` через границу.
- **Вердикты docs/ideas (для статус-блоков в Task 9):**

  | Идея | Статус в v4 |
  |---|---|
  | 01 стабильные id | Закрыто v4: обязательный id, ключ `${pid}/${cid}` |
  | 02 host-controlled rendering | Закрыто v4: `renderEntries`, дефолт реализован через него |
  | 03 config/overrides | Закрыто v4: `ResolveOptions.disable/overrides` + `Slot.override` |
  | 04 каталог для SSR/RSC | Отклонено: userland (`satisfies Record<Id, Plugin>`), non-goal REGISTRY.md |
  | 05 политики slot | Частично: `disable` в v4; limit/allow/deny — отклонено (SSR-вытеснение), userland над Resolution |
  | 06 dev-инспектор | Не в 4.0: userland над Resolution (плоские данные делают его тривиальным) |
  | 07 валидатор | Частично закрыто v4: диагностики резолвера; snapshot/testing-entry — userland |
  | 08 render pending | Закрыто v4: `Pending`/`Failed` компоненты на провайдере |
  | 09 ordering groups | Отклонено: `order` + `renderEntries` покрывают сценарий |
  | 10 scopes/private slots | Частично: per-factory store фасада = изоляция; scopes-контекст и private tokens отклонены |

- **Non-goals (в 4.0 НЕ входит):** per-entry `renderEntry` со статусом
  pending/failed; политики limit/allow/deny; ordering groups; scopes/private tokens;
  инспектор; standalone-валидатор; отдельный `create-slot/server`/`/rsc` entry;
  deprecated-алиасы v3; codemod. Пустая обёртка вокруг pending/failed entry решается
  конвенцией (non-null `Pending`/`Failed`, CSS `:empty`) — задокументировать, не
  механизировать.
- **Допущения:** peer React 19 (`react: *`); react 19.2 определяет condition
  `react-server` (проверено в node_modules); RSC-верификация — сборкой
  `examples/nextjs-app`; релиз собирает release-please; sourcemap в v4-сборке
  отключается (`sourcemap: false`) — post-build prepend директивы сдвигал бы
  маппинги на строку; вернуть можно позже отдельной задачей с `;`-префиксом mappings.
- Hidden context: отсутствует; план самодостаточен.

## Development Approach

- Тесты — в каждой задаче; задача закрыта только зелёной. Репозиторий зелёный
  ПОСЛЕ КАЖДОЙ задачи (включая `npm run bundle`): v3-файлы живут до Task 7 — их
  сьюты мигрируют в Tasks 2–6, а удаляются они ПЕРВЫМ шагом Task 7, атомарно со
  сменой tsup-entry (`lib/create-slot.tsx` — активный entry сборки до этого
  момента), до knip-гейта той же задачи.
- Одна задача за раз; малые сфокусированные изменения.
- Обновлять этот план при изменении объёма (`+` новые задачи, `BLOCKED:` блокеры,
  `[x]` сразу по завершении).
- Не полагаться на историю чата: все контракты — в этом файле.

## Testing Strategy

- Unit/поведенческие тесты обязательны в каждой кодовой задаче; покрывать успех,
  ошибки и края (пустые слоты, дубликаты id, discarded renders, StrictMode).
- `registry.test.tsx` мигрирует по явной карте (Tasks 2–3), а не удаляется втихую.
- Команды: `npm run test:run`, `npm run typecheck`, `npm run lint`, `npm run knip`,
  `npm run bundle`, `npm run test:rsc` (новый), `npm run bench` (санити),
  `npm run build:examples`, `npm run site:typecheck && npm run site:build`.

## What Goes Where

- Implementation Steps — всё достижимое в этом репозитории.
- Post-Completion — релиз, публикация, координация деплоя доков, ручная проверка.

## Implementation Steps

### Task 1: React-free ядро `create-slot/core`

**Why:** резолвер — фундамент; все остальные задачи потребляют `Resolution`.

**Files:**
- Create: `lib/core/types.ts`, `lib/core/define.ts`, `lib/core/resolve.ts`,
  `lib/core/index.ts`, `lib/core/resolve.test.ts`
- Modify: `vite.config.ts` (include → `lib/**/*.test.{ts,tsx}` — иначе `.test.ts`
  невидим для vitest и гейт собирает ноль тестов)

- [x] Типы из «Technical Details»: `ErasedComponent`, `Contribution`,
      `PluginDefinition`, `ContributionSpec`, `Override`, `Slot` (property-style
      методы), `ResolveOptions`, `ResolvedEntry`, `Diagnostic`, `Resolution`.
      Из React — только type-импорты.
- [x] `defineSlot(name)`: бросает на пустое имя; возвращает `{name, contribute,
      override}`. `contribute(id, spec)` валидирует id (непустой, без `/`) —
      нарушение НЕ бросает, а помечает contribution для диагностики резолвера
      (`invalid-contribution-id`).
- [x] `definePlugin`: identity + throw на пустой id (поведение v3 сохранено).
- [x] `resolvePlugins(plugins, options)`: группировка по слоту → `disable`
      (плагины целиком, contribution по полному id) → `overrides` (последний патч
      по target побеждает; slot патча обязан совпадать со слотом цели, иначе
      `override-slot-mismatch` и патч игнорируется) → сортировка
      `order || pluginIndex || declaredIndex` → `seq` → `Resolution{slots: Record,
      diagnostics}`. Ключ entry — `${pluginId}/${contributionId}`.
- [x] `entriesOf(resolution, slot)`: типизированный lookup — возвращает
      `readonly ResolvedEntry<P>[]` (component: `ComponentType<P>`, безопасное
      сужение внутри), пустой массив вместо undefined; чтение только own-property
      через `Object.hasOwn`.
- [x] Прототип-ключи: `Resolution.slots` строится на объекте без прототипа
      (`Object.create(null)` при сборке; итоговый объект нормализовать в
      plain-object для сериализации). Имена слотов `__proto__`, `constructor`,
      `hasOwnProperty` — легальные и не читают/не портят унаследованные значения.
      Тесты на все три имени: пустой слот с таким именем → `entriesOf` возвращает
      пустой массив (не `Object`/функцию), contribution в такой слот резолвится.
- [x] Type-level тест (`expectTypeOf` из vitest): компонент из
      `entriesOf(resolution, NavSlot)[0].component` принимает Props слота без
      каста — falsifier Codex P1 (строгая компиляция серверного host).
- [x] Тесты (`// @vitest-environment node`, без DOM): детерминизм (deepEqual двух
      вызовов), сортировка и tie-break, все шесть кодов диагностик, disable плагина
      vs contribution, override порядка и компонента, идемпотентность входов,
      пустые plugins/contributes, И ОТДЕЛЬНО: один плагин дважды в списке — полные
      id коллидируют, вторая копия каждого contribution отброшена с
      `duplicate-contribution-id` + есть `duplicate-plugin-id`.
- [x] `npm run test:run -- lib/core && npm run typecheck` — зелёные (проверить, что
      vitest РЕАЛЬНО собрал тесты — ненулевое число).

+ [x] (Task 1) `tsconfig.json`: target/lib подняты до ES2022 — biome-правило
  useObjectHasOwn автозаменяет `hasOwnProperty.call` на `Object.hasOwn`,
  которого нет в lib ES2020. Рантайм-требование (Node ≥16.9, evergreen)
  совместимо с peer React 19.

### Task 2: Клиентский адаптер — SlotProvider, SlotHost, ContributionBoundary

**Why:** React-слой поверх Resolution; сюда переезжает v3-механика изоляции и
декларативная половина покрытия `registry.test.tsx`.

**Files:**
- Create: `lib/adapter/provider.tsx`, `lib/adapter/host.tsx`,
  `lib/adapter/boundary.tsx`, `lib/adapter/hooks.ts`, `lib/adapter/adapter.test.tsx`
- Modify: `lib/error-boundary.tsx` (переиспользуется; минимальные правки сигнатур)

- [x] `SlotProvider({resolution, onError, Failed, Pending, children})`: два
      контекста — ResolutionContext (identity `resolution`) и HandlersContext
      (`useMemo` по трём значениям, читается лениво внутри boundary). Dev-эффект:
      `console.error` диагностик по NODE_ENV-conditional-const паттерну,
      с дедупликацией по содержимому (сериализованный список диагностик сравнивается
      с последним залогированным).
- [x] Per-slot props-context: лениво создаётся и кэшируется НА ДЕСКРИПТОРЕ под
      `Symbol.for("create-slot.props-context")`, идемпотентно (повторный вызов
      возвращает кэш — StrictMode/discarded-render безопасно). Тест: два «адаптера»
      (двойной импорт модуля через vi.resetModules) видят один контекст дескриптора.
- [x] `ContributionBoundary({pluginId, contributionId, slot, children})`:
      ContributionContext.Provider (для `useContribution`) → PluginErrorBoundary
      (onError + `Failed` c пропсами `{pluginId, contributionId, slot, error,
      reset}`) → Suspense (fallback — `Pending` c `{pluginId, contributionId, slot}`
      или null).
- [x] `SlotHost({slot, props, children, renderEntries})`: `useStableProps` (перенос
      v3); каждый entry → мемоизированный `<IsolatedEntry>` (перенос
      `IsolatedContribution` + `isolate()` WeakMap) с content-based comparator
      (key, pluginId, contributionId, order, component identity + value-compare
      пропсов). `renderEntries` вызывается ВСЕГДА (и с нулём entries), `children`
      тогда игнорируется (dev-warn при обоих). Дефолтный рендер — через тот же путь.
- [x] `useSlotProps(slot)`: `Props | null`. `useContribution()`: бросает вне
      contribution (префикс `[create-slot]`).
- [x] Перенос декларативных кейсов из `lib/registry.test.tsx` (карта миграции,
      отметить в чек-листе каждый): nested provider shadowing (v3 ~:182),
      reset/re-catch и error-loop guards (~:344, ~:408), изоляция ошибки одного
      entry, placeholder при пустом слоте, два хоста одного слота, StrictMode-прогон,
      `useSlotProps` из contribution, хост вне провайдера → throw. Плюс новые:
      `renderEntries` (метаданные, вызов при нуле), `Pending` при lazy-contribution.
- [x] `npm run test:run` — зелёный ЦЕЛИКОМ (v3-файлы и их сьюты не тронуты).

### Task 3: Фасад createSlot на per-factory store; миграция runtime-покрытия

**Why:** единственный source-compatible контракт v3. v3 `lib/runtime.ts` НЕ трогаем
(его используют slot.tsx и не-мигрированные сьюты до Task 6) — фасад получает КОПИЮ
механики стора, упрощённую до одной фабрики.

**Files:**
- Create: `lib/facade/create-slot.tsx`, `lib/facade/store.ts`,
  `lib/facade/facade.test.tsx`
- Modify: `lib/create-slot.test.tsx` (ТОЛЬКО import-строки: путь `./create-slot` →
  `./facade/create-slot`, type-импорт `Slot` → `RuntimeSlot`)
- Delete: `lib/runtime-store.test.tsx`, `lib/registry.test.tsx` (после переноса —
  см. чек-лист)

- [x] `store.ts`: копия класса из v3 `lib/runtime.ts` без Map-по-имени-слота (одна
      фабрика = один стор): entries, snapshot-кэш, listeners; `getServerSnapshot` →
      EMPTY; layout-effect регистрация; unmount-only cleanup; монотонный seq
      (per-factory достаточно: глобальный v3 `nextFillId` тай-брейкал только внутри
      одного слота). Test-seam `tracked()` на инстансе.
- [x] `createSlot<Props>(): RuntimeSlot<Props>`: филл (child обязателен — throw),
      `Host` (children = placeholder), `useProps()` (не-nullable); каждая фабрика —
      свой store и context. Runtime-канал НИГДЕ не пересекается с Resolution.
- [x] `lib/create-slot.test.tsx`: правки import-строк; каждое runtime-поведение
      проходит без изменений — доказательство source-compatibility (критерий 2).
- [x] Перенос кейсов `runtime-store.test.tsx` → `facade.test.tsx` на per-factory
      store: очистка после unmount (`tracked()` пуст), поздний unsubscribe не сносит
      живой set, стабильность ключей при смене контента. Удалить старый файл.
- [x] Перенос runtime-кейсов из `lib/registry.test.tsx` → `facade.test.tsx` (карта,
      отметить каждый): guard на self-unregister suspending fill (v3 ~:1322, фикс
      коммита 236f19f), fill-inside-own-placeholder fail-fast (~:1381),
      cross-root host (~:1406).
- [x] Чек-пункт сверки карты: каждый describe/it из `registry.test.tsx` отнесён к
      adapter.test (Task 2) / facade.test (этот Task) / «не переносится» с causa
      (например, тесты merge двух каналов — механика удалена дизайном;
      production-strip тест пишется заново в Task 5). После сверки — удалить
      `lib/registry.test.tsx`.
- [x] `npm run test:run` — зелёный целиком.

+ Карта сверки `registry.test.tsx` (все 47 кейсов):
  - **→ core/resolve.test.ts**: sorts by order/plugin/declaration; non-finite
    order; rejects empty plugin id and slot name; keeps app manifest fields
    typed; duplicate plugin id (диагностика вместо warn); contribution is
    plain data; renders without an order (default 0).
  - **→ adapter/adapter.test.tsx**: passes host props to contributions; empty
    slot renders nothing; host outside provider throws; nested provider
    shadow; no remount on rebuilt graph (усилено до inline resolution);
    add/remove plugins keeping survivors; throwing contribution contained +
    reported; reset/re-catch; no error loop; non-Error thrown value; renders-
    null counts as contributed; late-failure isolation; lazy chunk rejection;
    Failed-handler failure not isolated; drop without handler; prop names
    change; NaN/-0; StrictMode; children never forwarded (структурно — props
    отдельный bag); host-in-contribution nesting; useContribution (бывш.
    usePluginId) + throw outside.
  - **→ facade/facade.test.tsx**: fill unmount drop; useProps; placeholder
    while empty; fill keyed by registration; nested fill same slot;
    suspending-fill self-unregister guard (фикс 236f19f); placeholder-fill
    fail-fast; cross-root host; fill throw not isolated; + инверсия
    «shares one bucket between two same-name definitions» — per-factory
    сторы полностью изолированы (новый контракт).
  - **Не переносится (механика удалена дизайном)**: «ranks runtime fills
    against declared ones» и «NaN order reaches both channels» — merge двух
    каналов не существует; «ignores a reset after the host is gone» — reset
    живёт в неизменённом PluginErrorBoundary (v3-семантика сохранена
    переиспользованием файла).
  - **→ Task 5**: production-strip тест (пишется заново).

### Task 4: Публичная поверхность, ssr/streaming-тесты

**Why:** зафиксировать экспорты обоих entry и перенести гарантии SSR.

**Files:**
- Create: `lib/index.ts` (client entry: `"use client"` в исходнике, re-export core +
  адаптер + фасад)
- Modify: `lib/ssr.test.tsx`, `lib/streaming.test.tsx` (переписываются на v4 API)

  Примечание: v3 `lib/create-slot.tsx` НЕ трогается — остаётся до Task 6, чтобы
  `perf.test.tsx` жил до своей миграции.

- [x] Сверить фактические экспорты `lib/index.ts` и `lib/core/index.ts` с
      «Technical Details»: полный список, ничего лишнего/пропавшего.
- [x] `ssr.test.tsx` на v4: renderToString с module-scope `Resolution` даёт разметку
      со всеми contributions; гидрация без mismatch при том же `Resolution`;
      фасадные fills отсутствуют в серверной разметке и появляются после гидрации.
- [x] `streaming.test.tsx` на v4: deferred contribution стримится за own-boundary;
      без `Pending` — shell не меняется (fallback null); с `Pending` — shell
      содержит его вывод и `$RC`-своп происходит.
- [x] `npm run test:run` — зелёный целиком.

### Task 5: Диагностика и dev-эргономика

**Why:** «ничего тихо» — задокументированное преимущество v4.

**Files:**
- Modify: `lib/adapter/provider.tsx`, `lib/adapter/host.tsx`,
  `lib/adapter/adapter.test.tsx`

- [x] Dev-warn: `renderEntries` И `children` одновременно на `SlotHost`.
- [x] Тест: слот без записей в `resolution.slots` — легален, тих, рендерит
      placeholder (зафиксировать поведение).
- [x] Production-strip тест (пишется заново, старый удалён с registry.test.tsx в
      Task 3): все dev-ветки — module-level `NODE_ENV`-conditional-const; тест
      эмулирует production-условие и проверяет отсутствие console.error (механизм —
      как v3-тест в registry.test.tsx:889, описан здесь, файл-образец уже удалён).
- [x] `npm run test:run` — зелёный.

### Task 6: Perf-бюджеты и бенчи

**Why:** перф-модель — контракт; это последний сьют на v3 API — после него v3-код
не покрыт тестами и готов к удалению в Task 7.

**Files:**
- Modify: `lib/perf.test.tsx`, `lib/perf.bench.tsx` (на v4 API)

  Примечание: v3-файлы здесь НЕ удаляются — `lib/create-slot.tsx` остаётся активным
  tsup-entry в `package.json` до Task 7, и его удаление до смены сборки уронило бы
  `npm run bundle` на зелёном чекпойнте (находка Codex P2). После этой задачи v3-код
  жив, но больше не покрыт ни одним тестом — удаление атомарно со сменой entry в
  Task 7.

- [x] Перенос v3-бюджетов: 30 fills → 1 коммит хоста; провайдер с инлайновыми
      handlers → 0 обновлений contributions; много хостов → 0 лишних обновлений.
- [x] Новый бюджет «inline resolution»: родитель, вызывающий `resolvePlugins()` в
      рендере каждый тик, → 0 обновлений contribution-компонентов (только shells).
- [x] `perf.bench.tsx` на v4; `npm run bench` выполняется.
- [x] `npm run test:run && npm run typecheck && npm run bundle` — зелёные целиком.

### Task 7: Сборка, package.json, react-server smoke, CI

**Why:** два entry — новый класс рисков. Стратегия сборки зафиксирована по
эмпирической проверке tsup 8.5.1 (см. Context): один конфиг + post-build prepend.

**Files:**
- Create: `tsup.config.ts`, `scripts/prepend-use-client.mjs`,
  `test/react-server-smoke.mjs`, `test/chunk-sharing-smoke.cjs`
- Modify: `package.json` (exports, types, scripts, удалить tsup-блок),
  `knip.json`, `test/setup-tests.ts` (убрать import и afterEach-ассерт
  `trackedSlots` — глобальный стор уходит вместе с `lib/runtime.ts`; leak-проверки
  живут в facade.test на инстансах), `.github/workflows/ci.yml`,
  `.github/workflows/publish.yml`
- Delete (атомарно со сменой tsup-entry, Codex P2): `lib/create-slot.tsx`,
  `lib/slot.tsx`, `lib/provider.tsx`, `lib/plugin.ts`, `lib/runtime.ts`

- [x] Удалить пять v3-файлов + обновить `test/setup-tests.ts`;
      `grep -rn "\./slot\|\./provider\|\./runtime\|\./plugin" lib/` — пусто
      (кроме внутренних путей core/adapter/facade).
- [x] `tsup.config.ts`: ОДИН конфиг, entries `{index: "lib/index.ts", "core/index":
      "lib/core/index.ts"}`, `splitting: true`, `clean: true` (v3-конфиг его имел;
      без него в dist остаются stale `create-slot.*` артефакты, и `npm pack`
      упакует их — находка Codex P2), `sourcemap: false` (post-build prepend
      сдвигал бы маппинги; решение в Review Handoff), БЕЗ `banner`, dts для обоих,
      ESM+CJS, external react. После `npm run bundle` проверить: в `dist/` НЕТ
      `create-slot.*` (stale v3).
- [x] `scripts/prepend-use-client.mjs` (вызывается из `onSuccess` или отдельным
      script-шагом после tsup): дописывает `"use client";\n` В НАЧАЛО ровно двух
      файлов — `dist/index.js`, `dist/index.cjs` (prepend к началу файла ставит
      директиву ПЕРЕД `"use strict"`-преамбулой CJS — валидный пролог). Скрипт
      проверяет: директива — первая строка обоих файлов; `dist/core/**` и
      `dist/chunk-*` директивы НЕ содержат (иначе exit 1).
- [x] `package.json`: `exports` = `"."` → `{import: {types: ./dist/index.d.ts,
      default: ./dist/index.js}, require: {types: ./dist/index.d.cts, default:
      ./dist/index.cjs}}`, `"./core"` → аналогично `./dist/core/index.*`. Top-level
      `"types"` → `./dist/index.d.ts` (`package.json:24` сейчас указывает на
      исчезающий `dist/create-slot.d.ts` — node10-резолюция сломалась бы тихо).
      Итого 8 артефактов: `dist/index.{js,cjs,d.ts,d.cts}`,
      `dist/core/index.{js,cjs,d.ts,d.cts}`.
- [x] `test/react-server-smoke.mjs`: под `node --conditions react-server` —
      `await import("create-slot/core")` по SELF-REFERENCE specifier (через exports
      map, не file-путь) успешен; `await import("create-slot")` ПАДАЕТ (это
      доказывает, что condition реально течёт и граница закреплена с двух сторон);
      плюс grep `dist/core` на runtime-импорты `"react"` (must be none). Скрипт
      `"test:rsc": "node --conditions react-server test/react-server-smoke.mjs"`.
- [x] `test/chunk-sharing-smoke.cjs`: `require` обоих entry в одном процессе,
      `Object.is` на общем символе из core (например, один и тот же
      `resolvePlugins`), доказывает общие чанки в CJS.
- [x] `knip.json`: `paths` — `"create-slot": ["./lib/index.ts"]` И
      `"create-slot/core": ["./lib/core/index.ts"]` (текущий мапит на удалённый
      `./lib/create-slot.tsx`).
- [x] `ci.yml`: шаги `test:rsc` и chunk-smoke ПОСЛЕ `Bundle`; `publish.yml`: те же
      два шага перед публикацией (сейчас он гоняет lint/typecheck/test/bundle/pack,
      но не знал бы про rsc-инвариант).
- [x] `npm run bundle && npm run test:rsc && node test/chunk-sharing-smoke.cjs &&
      npm run knip && npm pack --dry-run` — зелёные.

### Task 8: Миграция примеров

**Why:** репозиторий должен остаться зелёным; примеры — живая верификация трёх сред,
включая RSC tier 2.

**Files:**
- Modify: `examples/crm-core/src/{slots.ts,plugin.ts,catalog.ts,runtime.tsx,
  views.tsx,index.ts,server.ts,state.ts,ui.tsx,plugins/pipeline.tsx,
  plugins/forecast.tsx,plugins/email.tsx,plugins/telephony.tsx}`,
  `examples/spa/src/*`, `examples/nextjs-pages/{pages/_app.tsx,lib/crm-server.ts,
  components/layout.tsx}`, `examples/nextjs-app/{app/layout.tsx,app/page.tsx,
  components/crm-shell.tsx,lib/crm-request.ts,lib/crm-server.ts,
  plugins/insights.tsx}`, `examples/*/README.md`

  Примечание: `state.ts` и `ui.tsx` импортируют `usePluginId` → `useContribution`
  (без них `tsc --noEmit` в crm-spa гарантированно красный).
  `plugins/{pipeline,email}.server.ts` библиотеку не импортируют — правок кода не
  требуют.

- [ ] `crm-core`: слоты через новый `defineSlot`; плагины через `contribute(id,
      spec)` с осмысленными id; `state.ts`/`ui.tsx` → `useContribution()`;
      `catalog.ts` остаётся app-кодом (подтверждает non-goal «no inventory
      helper»), возвращает вход для `resolvePlugins`.
- [ ] `spa`: module-scope `resolvePlugins` → `SlotProvider resolution=`; хосты →
      `SlotHost slot= props=`; фасадный `createSlot` — минимум одно место
      (тулбар/статусбар) как канонический runtime-паттерн.
- [ ] `nextjs-pages`: `resolution` в module scope, общий для сервера и клиента;
      per-tenant вариант — `useMemo` от списка из pageProps.
- [ ] `nextjs-app`: tier 2 — манифесты как обычные модули, импортирующие
      "use client" компоненты; server `layout.tsx` вызывает `resolvePlugins` и
      передаёт `Resolution` пропом в клиентский Providers; плюс один полностью
      серверный host на `entriesOf` + `ContributionBoundary`.
- [ ] README всех четырёх примеров — обновить код-сниппеты на v4.
- [ ] `npm run build:examples` — зелёный.

### Task 9: Документация, ADR, docs-site

**Why:** REGISTRY.md — дизайн-документ; три активных ADR противоречат v4 и без
статус-правок останутся ложными.

**Files:**
- Modify: `CONTEXT.md`, `REGISTRY.md`, `README.md`, `docs/ARCHITECTURE.md`,
  `docs/adr/0001-two-vocabularies.md`, `docs/adr/0002-manifest-lives-in-the-client-graph.md`,
  `docs/adr/0003-the-host-owns-the-boundary-not-the-loading.md`,
  `docs/ideas/01..10` (статус-блоки), `docs-site/src/snippets/*.tsx`,
  `docs-site/src/components/*-demo.client.tsx`, страницы `docs-site/src/pages`
- Create: `docs/adr/0004-resolution-core.md`

- [x] ADR 0004: одноканальный реестр + чистый резолвер + изгнание runtime в фасад;
      отвергнутые альтернативы (двухканальный вариант — SSR-вытеснение серверной
      разметки поздним fill; отдельный server-host entry — хрупкость директив).
- [x] Статус-правки существующих ADR: 0001 — amended by 0004 (тип `Slot`
      переименован; runtime-формы фасада сохранены); 0002 — superseded by 0004 в
      части tier 2 (core server-safe, манифест может жить в общем графе); 0003 —
      superseded by 0004 (`Pending` на провайдере; дефолт fallback=null сохранён).
- [x] `CONTEXT.md`: термин **Resolution**; Fill/runtime-канал — façade-only; Slot —
      дескриптор.
- [x] `REGISTRY.md`: переписать под v4 (позиционные ключи, buildIndex, merge —
      удалить; Resolution, диагностики, two-module discipline, tier 1/2 — добавить);
      non-goals дополнить списком из Review Handoff.
- [x] `README.md` + quick-start сниппет: v4-пример как в `spa`.
- [x] `migrating.tsx`: таблица v3→v4 (`PluginProvider plugins=` →
      `resolvePlugins`+`SlotProvider`; `Nav.Host` → `SlotHost slot={Nav} props=`;
      `Nav.Fill` → фасад `createSlot`; `usePluginId` → `useContribution`;
      `type Slot` фасада → `RuntimeSlot`).
- [x] `docs/ideas/01..10`: статус-блок сверху каждого файла ИЗ ТАБЛИЦЫ в Review
      Handoff (сопоставление уже решено там, не выводить заново), ссылка на ADR 0004.
- [x] `npm run site:typecheck && npm run site:build` — зелёные.

### Task 10: Верификация acceptance criteria

- [x] Пройти все 7 критериев Overview по одному, зафиксировать результат в плане.
- [x] Полный прогон: `npm run lint && npm run typecheck && npm run test:run &&
      npm run knip && npm run bundle && npm run test:rsc &&
      node test/chunk-sharing-smoke.cjs && npm pack --dry-run &&
      npm run build:examples && npm run site:build`.

+ Результаты верификации (2026-08-27):
  1. `test:rsc` — ok (core грузится по self-reference, клиентский entry падает
     под react-server, в dist/core нет react-импортов).
  2. `lib/create-slot.test.tsx` — дифф ровно 1 строка (путь импорта); все
     runtime-формы фасада зелёные без изменений тестового кода.
  3. lint / typecheck / test:run (114) / knip / bundle / `npm pack --dry-run`
     (12 файлов, 20.7 kB) — зелёные.
  4. `build:examples` (3/3) и `site:build` (41 страница) — зелёные; nextjs-app
     передаёт Resolution через RSC-границу из server layout и рендерит
     серверный host (app/server-nav.tsx).
  5. Perf-бюджеты в lib/perf.test.tsx зелёные, включая новый «inline
     resolution → 0 обновлений contributions»; bench выполняется.
  6. Шесть кодов диагностик покрыты тестами core; dev-лог дедуплицирован,
     production-strip подтверждён тестом.
  7. Чанки общие (`Object.is` smoke), "use client" — первой строкой только в
     dist/index.js|cjs, core и чанки чистые, stale-артефактов v3 нет.

### Task 11: Финальная документация

- [x] Обновить `docs/ARCHITECTURE.md` схемой двух entry.
- [x] Перенести этот план в `docs/plans/completed/`.

## Technical Details

### Полная публичная поверхность v4

```ts
// ═══ create-slot/core — React-free (только type-импорты из react) ═══

export type ErasedComponent = ComponentType<never>

export type Contribution = {
  slot: string
  id: string                       // локальный, без "/", уникален в плагине
  order: number
  component: ErasedComponent
}

export type PluginDefinition = { id: string; contributes?: readonly Contribution[] }
export function definePlugin<T extends PluginDefinition>(definition: T): T

export type ContributionSpec<Props extends object> = {
  order?: number                   // default 0
  component: ComponentType<Props>
}

export type Override = {
  readonly slot: string
  readonly target: string          // полный id `${pluginId}/${contributionId}`
  readonly order?: number
  readonly component?: ErasedComponent
}

// Методы — property-style (не method-style): строгая вариантность по Props,
// несовместимый дескриптор не пройдёт тихо.
export type Slot<Props extends object> = {
  readonly name: string
  readonly contribute: (id: string, spec: ContributionSpec<Props>) => Contribution
  readonly override: (
    target: string,
    patch: { order?: number; component?: ComponentType<Props> },
  ) => Override
}
export function defineSlot<Props extends object = Record<never, never>>(name: string): Slot<Props>

export type ResolveOptions = {
  disable?: { plugins?: readonly string[]; contributions?: readonly string[] }
  overrides?: readonly Override[]
}

// Generic по Props восстанавливает тип component для типизированных lookups
// (entriesOf); без аргумента (= never) — стёртая форма, в которой entries лежат
// в Resolution.slots. ComponentType контравариантен по Props, поэтому стёртая
// форма — корректный супертип любой типизированной.
export type ResolvedEntry<Props extends object = never> = {
  key: string                      // `${pluginId}/${contributionId}` — React key
  pluginId: string
  contributionId: string
  slot: string
  order: number
  seq: number                      // позиция после сортировки
  component: ComponentType<Props>  // ResolvedEntry (без аргумента) === ErasedComponent
}

export type Diagnostic = {
  code:
    | "duplicate-plugin-id" | "duplicate-contribution-id" | "invalid-contribution-id"
    | "unknown-disable-target" | "unknown-override-target" | "override-slot-mismatch"
  message: string
  pluginId?: string
  contributionId?: string
  slot?: string
}

// Метаданные JSON-совместимы; component — функция/client reference, поэтому
// JSON round-trip НЕвозможен. Сериализация через RSC-границу работает при
// two-module discipline (component = client reference).
export type Resolution = {
  readonly slots: Readonly<Record<string, readonly ResolvedEntry[]>>
  readonly diagnostics: readonly Diagnostic[]
}

export function resolvePlugins(
  plugins: readonly PluginDefinition[],
  options?: ResolveOptions,
): Resolution

// Возвращает ТИПИЗИРОВАННЫЕ entries: component: ComponentType<P> — серверный host
// рендерит <Component {...props}/> без каста (внутри — безопасное сужение: contribute()
// гарантировал соответствие при регистрации). Lookup — только own-property
// (Object.hasOwn): имена слотов вроде "constructor"/"__proto__" легальны и не должны
// читать унаследованные значения.
export function entriesOf<P extends object>(
  resolution: Resolution, slot: Slot<P>,
): readonly ResolvedEntry<P>[]

// ═══ create-slot — "use client"; re-export всего из core ═══

export type SlotError = {
  pluginId: string; contributionId: string; slot: string; error: unknown
}

export function SlotProvider(props: {
  resolution: Resolution
  onError?: (error: SlotError) => void
  Failed?: ComponentType<SlotError & { reset: () => void }>
  Pending?: ComponentType<{ pluginId: string; contributionId: string; slot: string }>
  children?: ReactNode
}): ReactElement

export type HostEntry = {
  key: string; pluginId: string; contributionId: string; order: number
  node: ReactNode                  // изолирован и keyed библиотекой
}

export function SlotHost<Props extends object>(props: {
  slot: Slot<Props>
  children?: ReactNode             // placeholder при пустом слоте
  renderEntries?: (entries: readonly HostEntry[]) => ReactNode
} & ({} extends Props ? { props?: Props } : { props: Props })): ReactElement | null

export function useSlotProps<P extends object>(slot: Slot<P>): P | null
export function useContribution(): { slot: string; pluginId: string; contributionId: string }

export function ContributionBoundary(props: {
  pluginId: string; contributionId: string; slot: string; children: ReactNode
}): ReactElement

// фасад — source-compatible по runtime-формам; тип переименован
export type RuntimeSlot<Props> = FC<{ children: ReactElement; order?: number }> & {
  Host: FC<PropsWithChildren<Props>>
  useProps(): Props
}
export function createSlot<Props = unknown>(): RuntimeSlot<Props>
```

### Инварианты и края

- Сортировка декларативного канала — семантика v3: `order || pluginIndex ||
  declaredIndex`; `seq` — позиция после сортировки. `override.order` участвует в
  сортировке вместо manifest-значения.
- Дубликаты: `duplicate-plugin-id` — диагностика; при этом полные id contributions
  дубликата коллидируют → вторая копия каждого отброшена с
  `duplicate-contribution-id` (первый выигрывает — детерминировано и диагностировано;
  «оба в графе» возможно только при разных contribution id, что для копии одного
  плагина исключено). Тест обязателен (Task 1).
- `resolvePlugins` не мутирует входы и детерминирована (никаких Date/random).
- Facade store: `getServerSnapshot` — всегда общий `EMPTY`; идентичность филла
  (key/order/seq) читается один раз на маунте; смена контента реконсилирует, не
  перемонтирует. Per-factory seq достаточен (v3-глобальный тай-брейкал только внутри
  слота).
- `useStableProps`: перенос v3 c комментарием о discarded renders (identity может
  потеряться, значение — никогда).
- Props-context: НА дескрипторе, `Symbol.for("create-slot.props-context")`, ленивое
  идемпотентное создание. Module-level WeakMap в адаптере ЗАПРЕЩЁН (ESM+CJS
  dual-copy → useSlotProps теряет хост).
- Handlers-контекст меняет value (useMemo по трём значениям); latest-ref запрещён
  для всего, что рендерит UI (устаревшие замыкания коммитятся в DOM).
- Dev-лог диагностик — с дедупликацией по содержимому (инлайновый resolvePlugins
  легален по критерию 5 и не должен флудить).
- `HostEntry.node` уже несёт key; правило для `renderEntries`: свою обёртку ключить
  `entry.key` (документировать; dev-проверка — вне объёма 4.0).
- Прототип-ключи: имена слотов — произвольные непустые строки, включая
  `__proto__`/`constructor`/`hasOwnProperty`. `Resolution.slots` собирается на
  объекте без прототипа; ЛЮБОЕ чтение из него (entriesOf, SlotHost) — только
  own-property (`Object.hasOwn`). Наивное `record[name]` ЗАПРЕЩЕНО.

## Post-Completion

**Релиз:**
- Merge с conventional-сообщением `feat!: v4 resolution core` (+ `BREAKING CHANGE:`
  футер) — release-please соберёт 4.0.0; публикация через `publish.yml`.
- **Координация доков:** `pages.yml` деплоит docs-site на каждый push в main —
  v4-доки уйдут в прод при мерже фичевого PR, ДО существования 4.0.0 на npm.
  Мержить фичевую ветку и release-PR максимально близко по времени, либо временно
  придержать деплой pages (ручное решение при мерже).

**Rollback (если 4.0.0 сломан):**
- `npm dist-tag add create-slot@3.1.0 latest` + `npm deprecate create-slot@4.0.0
  "<причина>"`. Revert-PR не даёт release-please пути вниз — следующий релиз только
  4.0.1. Остаточное: 4.0.0 на registry (unpublish-окно ≤72ч), git-тег, v4-доки на
  Pages (передеплоить с ветки 3.x при необходимости).

**Manual verification:**
- `npm run dev:next-app` — визуально: стриминг deferred contribution, отсутствие
  hydration-warning в консоли, серверный host рендерит contributions.
- `npm run dev:spa` — фасадный слот (тулбар) наполняется/очищается при навигации.
