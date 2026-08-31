# Инспектор plugin graph

> Статус: **Не в 4.0** (ADR 0004): `Resolution` — плоские данные, инспектор пишется как userland `.map` без инструментации ядра.

## Проблема

Composition graph не виден в React tree целиком: fills объявлены в одном месте,
hosts находятся в другом, declarative contributions приходят из manifests, а
часть entries может быть отключена политикой или завершиться ошибкой. По одному
DOM невозможно понять, почему contribution отсутствует или оказался в
неожиданной позиции.

## Предложение

Добавить development-only entrypoint:

```tsx
import { PluginInspector } from "create-slot/devtools"

;<PluginProvider plugins={plugins}>
  <App />
  <PluginInspector />
</PluginProvider>
```

Инспектор показывает:

- активные plugins и их порядок;
- slots и число смонтированных hosts;
- contribution ID, plugin ID, channel и итоговый order;
- отключённые и отклонённые entries;
- slots без host и hosts без contributions;
- pending и failed contributions;
- последние изменения resolved graph.

Первая версия может быть обычной React-панелью. Browser extension не требуется.

## Ограничение данных

Инспектор читает только metadata. Он не сериализует host props, React elements,
ошибочные значения или пользовательские данные. Текст ошибки показывается
только через уже существующий безопасный formatter приложения.

## Границы

- Production build не содержит UI инспектора и его сообщений.
- Инспектор ничего не включает, не отключает и не переупорядочивает.
- Он не становится вторым registry и не влияет на render path.
- Измерение render count можно добавить отдельно после проверки стоимости.

## Критерии готовности

- По отсутствующему contribution можно определить точную причину.
- Несколько providers и одинаковые slot names различаются в интерфейсе.
- Runtime и declarative channels отображаются раздельно.
- Открытие и закрытие панели не перемонтирует приложение.
- Tree shaking полностью удаляет entrypoint из production bundle, если он не
  импортирован.
