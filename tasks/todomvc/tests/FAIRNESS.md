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

Reference fixtures should include a compliant semantic implementation, an
alternative DOM implementation, and a known-broken implementation before
expanding the real matrix. The current mock generator is a smoke fixture, not
evidence that every alternative DOM passes.
