# Reference Assets and Sources

## 1. Принцип

Не использовать live коммерческие приложения как прямой runtime oracle. Их можно использовать только как вдохновение/класс задачи. Для benchmark-а нужны замороженные и лицензируемые reference fixtures:

```text
- open/permissive spec;
- screenshots;
- semantic UI representation;
- expected values;
- e2e scenarios;
- synthetic data;
- source/license notes.
```

## 2. Кандидаты для MVP

### 2.1 TodoMVC

Источник:

```text
https://github.com/tastejs/todomvc
https://github.com/tastejs/todomvc/blob/master/app-spec.md
```

Почему подходит:

```text
- официальный app spec в Markdown;
- хорошо известный behavioral surface;
- CRUD/state/filter/edit/localStorage;
- маленький, но достаточно показательный;
- удобно проверять e2e;
- хорошо вскрывает проблемы data model при evolution steps.
```

Что взять:

```text
- app-spec.md как reference spec;
- behavior list as acceptance criteria;
- neutral semantic UI tree;
- собственные screenshots, снятые с выбранной reference implementation или synthetic implementation;
- Playwright e2e по spec.
```

MVP task:

```text
tasks/todomvc
```

### 2.2 RealWorld / Conduit Lite

Источник:

```text
https://github.com/realworld-apps/realworld
https://docs.realworld.show/
```

Почему подходит:

```text
- Medium-like app class;
- есть shared API spec/theme/e2e ecosystem;
- более реалистично, чем todo;
- routing, cards, tags, authors, favorites, pagination-like flows.
```

Для MVP не брать fullstack Conduit. Сделать `Conduit Lite`:

```text
- mock data only;
- homepage;
- feed tabs;
- article cards;
- tag filter;
- article page;
- author page later in evolution.
```

MVP task:

```text
tasks/conduit-lite
```

### 2.3 Flowbite Admin Dashboard / Figma UI Kit

Источники:

```text
https://github.com/themesberg/flowbite-admin-dashboard
https://github.com/themesberg/tailwind-figma-ui-kit
```

Почему подходит:

```text
- visual/layout-heavy benchmark;
- dashboard, charts, tables, cards, sidebars, CRUD pages;
- есть Figma/design-kit источник;
- permissive/open-source status в repo metadata;
- удобно использовать как style/layout source.
```

Что взять:

```text
- dashboard layout patterns;
- metric cards;
- sidebar/header;
- table;
- chart placeholder;
- mobile/responsive reference;
- style tokens.
```

MVP task:

```text
tasks/dashboard-lite
```

### 2.4 Boardly Kanban, synthetic

Источник:

```text
Synthetic fixture inspired by kanban products.
No direct Trello copying.
```

Почему подходит:

```text
- отлично проверяет state model;
- фиксированные колонки быстро вскрывают лапшу;
- evolution steps с labels/custom columns/archive/comments дают сильный maintainability signal.
```

MVP optional:

```text
tasks/boardly-kanban
```

## 3. Как готовить reference bundle

### 3.1 Freeze

Для каждого task:

```text
1. Выбрать source.
2. Проверить лицензию.
3. Снять/создать screenshots desktop/tablet/mobile.
4. Написать semantic-ui.xml.
5. Создать mock-data.json.
6. Создать expected-values.json.
7. Написать acceptance-criteria.md.
8. Написать tests.
9. Сохранить source-notes.md.
```

### 3.2 Normalize

Избегать:

```text
- брендовых логотипов;
- trademarked copy;
- live user data;
- random dates;
- external API calls;
- source code copying, если цель — проверка генерации.
```

Использовать:

```text
- neutral brand names;
- synthetic users;
- fixed dates;
- deterministic mock data;
- localStorage or in-memory state;
- static chart placeholders, если chart logic не в scope.
```

### 3.3 Semantic UI representation

Для text-only моделей semantic UI representation должен передавать:

```text
- screen hierarchy;
- visible text;
- role of elements;
- layout shape;
- responsive behavior;
- style intent;
- data examples;
- interaction affordances.
```

Не передавать:

```text
- грязный raw DOM;
- random generated class names;
- analytics nodes;
- hidden modals/portals unrelated to current state;
- огромные SVG;
- unrelated scripts.
```

## 4. Recommended first reference tasks

### 4.1 TodoMVC Lifecycle

```text
v0:
- create/edit/delete/toggle/filter/clear completed/localStorage

v1:
- add due dates

v2:
- add search

v3:
- add projects

v4:
- replace footer filters with sidebar views

v5:
- bulk actions

v6:
- remove projects and clean up
```

### 4.2 Dashboard Lite

```text
v0:
- sidebar/header/metric cards/chart/table

v1:
- date range filter

v2:
- table search

v3:
- status filter

v4:
- detail drawer

v5:
- change chart layout

v6:
- remove one metric card and keep responsive grid clean
```

### 4.3 Conduit Lite

```text
v0:
- homepage/feed/article cards/tags/article page

v1:
- author pages

v2:
- tag filtering

v3:
- favorites

v4:
- search

v5:
- replace featured article with editor picks

v6:
- drafts/published status
```

## 5. Source notes format

Каждый task должен иметь `reference/source-notes.md`:

```markdown
# Source Notes

Source name:
Source URL:
License:
Date accessed:
What was reused:
What was normalized:
What was not reused:
Trademark/brand removals:
Open questions:
```

## 6. Licensing checklist

Перед включением reference:

```text
- repo license present;
- design asset license checked;
- no private/commercial assets copied;
- screenshots allowed for internal benchmark, если public distribution uncertain;
- generated benchmark uses neutral branding;
- source attribution included;
- license file saved or linked.
```

## 7. Не брать в MVP

```text
- live Todoist/Trello screenshots with branded UI;
- private Figma links;
- SaaS apps requiring login;
- pages with dynamic ads/popups;
- copyrighted marketing copy;
- production user data.
```
