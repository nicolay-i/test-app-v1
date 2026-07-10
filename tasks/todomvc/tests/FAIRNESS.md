# TodoMVC Test Fairness Audit

The tests assert observable behavior and accessible control names. They do not
require a component name, framework state shape, storage key, CSS class, or a
specific internal DOM hierarchy. `li` is used only as the task-row container
defined by the TodoMVC semantic reference; controls and content are resolved
from visible text or roles.

| Suite | Observable contract | Selector strategy | Permitted alternatives |
| --- | --- | --- | --- |
| `base/e2e` | Create, complete, filter todos | Accessible input, checkbox, visible task text; filter may be link or button | Any component structure and filter control type |
| `base/values` | Empty todo rejected and state survives reload | Accessible input, visible text and count | Any local persistence key or serialization |
| `base/visual` | TodoMVC shell is renderable | Accessible heading and screenshot | Any CSS/layout that exposes the product shell |
| `01-due-dates` | Optional due dates persist and overdue task is visibly distinct | Label/type fallback for date, row text, computed visual signature against a normal row | Any date format and any visible CSS distinction; no required class name |
| `02-search` | Search filters without mutation and composes with filters | Searchbox/textbox fallback, visible task text | Any search control rendering and filter control type |
| `03-tags` | Tags can be assigned, filtered and persisted | Checkbox/select/button fallbacks, visible row text | Checkbox, select, or button tag picker |
| `04-remove-tags` | Tag controls disappear while legacy data remains readable | Accessible creation control, absence of tag text/control, visible legacy task | Any migration implementation or storage key |

## Fixture proof

`tasks/todomvc/test-fixtures/` defines three deterministic fixtures. Они исполняются
через `pnpm proof:fairness` или отдельными mock execution:

| Fixture | Профиль | Ожидаемый результат | Проверенный execution |
| --- | --- | --- | --- |
| A: compliant reference | `happy` | base suite проходит | `20260710T150847Z-mock-5cf782` |
| B: alternative DOM | `alternative-dom` | base suite проходит | `20260710T150942Z-mock-0bfcd1` |
| C: intentionally broken | `intentionally-broken` | падает только E2E-критерий Completed filter | `20260710T151005Z-mock-586e59` |

Профиль B меняет DOM-оболочку, class names и ключ localStorage. Профиль C сохраняет
остальные контролы, но делает фильтр Completed неэффективным. Это доказывает
поведение базового suite; cumulative эволюционные suites проверяются отдельно в
lifecycle proof и не должны подменять этот audit.
