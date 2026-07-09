export const mvpConfig = `id: ape_mvp_001
seed: 42
outputDir: runs

opencode:
  autoApprove: true
  format: json
  attachUrl: null
  timeoutMs: 900000

scaffold:
  id: vite-react-ts
  path: scaffolds/vite-react-ts

models:
  - id: deepseek-v4-flash-free
    providerModel: opencode/deepseek-v4-flash-free
  - id: mimo-v2.5-free
    providerModel: opencode/mimo-v2.5-free
  - id: nemotron-3-ultra-free
    providerModel: opencode/nemotron-3-ultra-free

tasks:
  - todomvc

prompts:
  system:
    - S2-maintainable-simple
  user:
    - U1-structured
    - U3-semantic-ui
    - U5-maintainable
  edit:
    - E2-smallest-maintainable-change

runsPerCell: 2
maxVersions: 5
maxRepairAttempts: 1
concurrency: 2
randomizeOrder: true
`;

export const exampleTaskYaml = `id: _example
name: Example Task
version: 0.1.0
kind: crud_stateful
scaffold: vite-react-ts
license_status: synthetic

source:
  name: Synthetic
  url: none
  license: internal
  notes: Placeholder task created by pnpm bench init.

reference:
  spec: reference/spec.md
  acceptanceCriteria: reference/acceptance-criteria.md
  semanticUi: reference/semantic-ui.xml
  expectedValues: reference/expected-values.json

constraints:
  framework: react
  language: typescript
  persistence: localStorage
  backend: none

checks:
  install: true
  build: true
  runtimeSmoke: true
  e2e:
    - tests/base/e2e.spec.ts
  values:
    - tests/base/values.spec.ts
  visual:
    - tests/base/visual.spec.ts
  codeHealth: true

promptArms:
  user:
    - U1-structured

scoring:
  weights: scoring/weights.yaml

evolution:
  - id: 01-add-due-dates
    prompt: evolution/01-add-due-dates.md
    tests:
      - tests/evolution/01-due-dates.spec.ts

  - id: 02-add-search
    prompt: evolution/02-add-search.md
    tests:
      - tests/evolution/02-search.spec.ts

  - id: 03-add-tags
    prompt: evolution/03-add-tags.md
    tests:
      - tests/evolution/03-tags.spec.ts

  - id: 04-remove-tags
    prompt: evolution/04-remove-tags.md
    tests:
      - tests/evolution/04-remove-tags.spec.ts
    disabledTests:
      - tests/evolution/03-tags.spec.ts
`;

export const todoMvcTaskYaml = `id: todomvc
name: TodoMVC Lifecycle
version: 0.1.0
kind: crud_stateful
scaffold: vite-react-ts
license_status: permissive_reference

source:
  name: TodoMVC
  url: https://github.com/tastejs/todomvc
  license: MIT or repo-stated license
  notes: Reference behavior derived from TodoMVC app spec. Implementation code is not copied.

reference:
  spec: reference/spec.md
  acceptanceCriteria: reference/acceptance-criteria.md
  semanticUi: reference/semantic-ui.xml
  expectedValues: reference/expected-values.json

constraints:
  framework: react
  language: typescript
  persistence: localStorage
  backend: none

checks:
  install: true
  build: true
  runtimeSmoke: true
  codeHealth: true

promptArms:
  user:
    - U1-structured
    - U3-semantic-ui
    - U5-maintainable

scoring:
  weights: scoring/weights.yaml

evolution: []
`;

export const todoMvcSpec = `# TodoMVC Lifecycle

Build a local TodoMVC-style task app using React, TypeScript and localStorage.

## Goal

Users can create, complete, edit, delete and filter tasks. The generated code should stay maintainable across later evolution steps.

## Constraints

- No backend.
- Persist tasks in localStorage.
- Keep the app runnable through pnpm dev and pnpm build.
`;

export const todoMvcAcceptanceCriteria = `# Acceptance Criteria

- User can create a task by typing text and pressing Enter.
- Empty tasks are not created.
- User can mark a task complete and incomplete.
- Active filter shows only incomplete tasks.
- Completed filter shows only completed tasks.
- Clear completed removes completed tasks.
- Task state persists after refresh.
`;

export const todoMvcSemanticUi = `<screen name="TodoMVC" viewport="1440x900">
  <main width="550" align="center">
    <title level="1">todos</title>
    <input role="new-todo" placeholder="What needs to be done?" autofocus="true" />
    <section name="todo-list">
      <todo-item state="active" title="Ship benchmark MVP" />
      <todo-item state="completed" title="Read TodoMVC spec" />
    </section>
    <footer>
      <counter>1 item left</counter>
      <filters active="All">
        <filter>All</filter>
        <filter>Active</filter>
        <filter>Completed</filter>
      </filters>
      <button>Clear completed</button>
    </footer>
  </main>
</screen>
`;

export const todoMvcExpectedValues = `{
  "initial": {
    "visibleTitle": "todos",
    "filters": ["All", "Active", "Completed"]
  },
  "afterCreateTask": {
    "taskText": "Ship benchmark MVP",
    "itemsLeft": "1 item left"
  }
}
`;

export const todoMvcE2eSpec = `import { expect, test } from "@playwright/test";

async function toggleTodo(page: import("@playwright/test").Page, title: string) {
  await page.locator("li").filter({ hasText: title }).getByRole("checkbox").check();
}

async function clickFilter(page: import("@playwright/test").Page, name: string) {
  const link = page.getByRole("link", { name: new RegExp(\`^\${name}$\`, "i") });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(\`^\${name}$\`, "i") }).click();
}

test("creates and completes a todo", async ({ page }) => {
  await page.goto("/");

  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.fill("Ship benchmark MVP");
  await input.press("Enter");

  await expect(page.getByText("Ship benchmark MVP")).toBeVisible();
  await expect(page.getByText(/1 item left/i)).toBeVisible();

  await toggleTodo(page, "Ship benchmark MVP");
  await expect(page.getByText(/0 items left|0 item left/i)).toBeVisible();
});

test("filters active and completed todos", async ({ page }) => {
  await page.goto("/");

  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.fill("Active task");
  await input.press("Enter");
  await input.fill("Completed task");
  await input.press("Enter");

  await toggleTodo(page, "Completed task");
  await clickFilter(page, "Active");
  await expect(page.getByText("Active task")).toBeVisible();
  await expect(page.getByText("Completed task")).toBeHidden();

  await clickFilter(page, "Completed");
  await expect(page.getByText("Completed task")).toBeVisible();
  await expect(page.getByText("Active task")).toBeHidden();
});
`;

export const todoMvcValuesSpec = `import { expect, test } from "@playwright/test";

test("does not create empty todos and persists state", async ({ page }) => {
  await page.goto("/");

  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.press("Enter");
  await expect(page.locator("li")).toHaveCount(0);

  await input.fill("Persisted task");
  await input.press("Enter");
  await page.reload();

  await expect(page.getByText("Persisted task")).toBeVisible();
  await expect(page.getByText(/1 item left/i)).toBeVisible();
});
`;

export const todoMvcVisualSpec = `import { expect, test } from "@playwright/test";

test("captures TodoMVC desktop shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /todos/i })).toBeVisible();
  await page.screenshot({ fullPage: true });
});
`;

export const todoMvcEvolutionDueDatesPrompt = `Add optional due dates to todos.

Requirements:
- User can create a todo without a due date.
- User can assign a due date while editing a todo.
- Due date is visible on the todo row.
- Overdue active todos are visually distinguishable.
- Due dates persist after refresh.
- Existing TodoMVC behavior must keep working.
`;

export const todoMvcEvolutionSearchPrompt = `Add search by todo title.

Requirements:
- Search filters visible todos by title.
- Search works together with All / Active / Completed filters.
- Clearing search restores the current filter view.
- Search does not delete or mutate todos.
- Existing due date behavior must keep working.
`;

export const todoMvcEvolutionTagsPrompt = `Add tags to todos.

Requirements:
- Todo can have zero or more tags.
- Use predefined tags: Work, Personal, Urgent.
- User can edit tags for an existing todo.
- User can filter by one tag at a time.
- Tags persist after refresh.
- Existing search, due dates, and TodoMVC behavior must keep working.
`;

export const todoMvcEvolutionRemoveTagsPrompt = `Remove the tags feature completely.

Requirements:
- Remove tag UI from create/edit flows.
- Remove tag filter UI.
- Existing todos should still load even if old persisted data contains tags.
- Search, due dates, filters, editing, completion, deletion, and persistence must keep working.
- Remove dead tag-related code where practical.
`;

export const todoMvcEvolutionDueDatesSpec = `import { expect, test } from "@playwright/test";

async function addTodo(page: import("@playwright/test").Page, title: string) {
  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.fill(title);
  await input.press("Enter");
}

async function dueDateInput(page: import("@playwright/test").Page) {
  const byLabel = page.getByLabel(/due date/i);
  if ((await byLabel.count()) > 0) {
    return byLabel.first();
  }
  return page.locator('input[type="date"]').first();
}

function todoRow(page: import("@playwright/test").Page, title: string) {
  return page.locator("li").filter({ has: page.getByText(title, { exact: true }) });
}

test("creates todos with and without due dates", async ({ page }) => {
  await page.goto("/");

  await addTodo(page, "No due date task");
  await expect(page.getByText("No due date task")).toBeVisible();

  const dueDate = await dueDateInput(page);
  await dueDate.fill("2026-08-15");
  await addTodo(page, "Due date task");

  const row = todoRow(page, "Due date task");
  await expect(row).toContainText(/2026-08-15|Aug 15,? 2026|8\\/15\\/2026|15\\.08\\.2026/);
});

test("due dates persist and overdue active todos are marked", async ({ page }) => {
  await page.goto("/");

  const dueDate = await dueDateInput(page);
  await dueDate.fill("2000-01-01");
  await addTodo(page, "Overdue task");
  await page.reload();

  const row = todoRow(page, "Overdue task");
  await expect(row).toBeVisible();
  await expect(row).toContainText(/2000-01-01|Jan 1,? 2000|1\\/1\\/2000|01\\.01\\.2000/);
  await expect(row).toHaveClass(/overdue|late|past-due/);
});
`;

export const todoMvcEvolutionSearchSpec = `import { expect, test } from "@playwright/test";

async function addTodo(page: import("@playwright/test").Page, title: string) {
  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.fill(title);
  await input.press("Enter");
}

async function searchInput(page: import("@playwright/test").Page) {
  const input = page.getByRole("searchbox", { name: /search/i });
  if ((await input.count()) > 0) {
    return input.first();
  }
  return page.getByRole("textbox", { name: /search/i }).first();
}

async function clickFilter(page: import("@playwright/test").Page, name: string) {
  const link = page.getByRole("link", { name: new RegExp(\`^\${name}$\`, "i") });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(\`^\${name}$\`, "i") }).click();
}

test("search filters todos by title without mutating them", async ({ page }) => {
  await page.goto("/");

  await addTodo(page, "Write benchmark report");
  await addTodo(page, "Buy milk");

  const search = await searchInput(page);
  await search.fill("benchmark");
  await expect(page.getByText("Write benchmark report")).toBeVisible();
  await expect(page.getByText("Buy milk")).toBeHidden();

  await search.fill("");
  await expect(page.getByText("Write benchmark report")).toBeVisible();
  await expect(page.getByText("Buy milk")).toBeVisible();
});

test("search composes with active and completed filters", async ({ page }) => {
  await page.goto("/");

  await addTodo(page, "Active search target");
  await addTodo(page, "Completed search target");
  await page.locator("li").filter({ hasText: "Completed search target" }).getByRole("checkbox").check();

  const search = await searchInput(page);
  await search.fill("search target");

  await clickFilter(page, "Active");
  await expect(page.getByText("Active search target")).toBeVisible();
  await expect(page.getByText("Completed search target")).toBeHidden();

  await clickFilter(page, "Completed");
  await expect(page.getByText("Completed search target")).toBeVisible();
  await expect(page.getByText("Active search target")).toBeHidden();
});
`;

export const todoMvcEvolutionTagsSpec = `import { expect, test } from "@playwright/test";

async function addTodo(page: import("@playwright/test").Page, title: string) {
  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.fill(title);
  await input.press("Enter");
}

async function setTag(page: import("@playwright/test").Page, tag: string) {
  const checkbox = page.getByRole("checkbox", { name: new RegExp(tag, "i") });
  if ((await checkbox.count()) > 0) {
    await checkbox.first().check();
    return;
  }
  const select = page.getByLabel(/tag/i);
  if ((await select.count()) > 0) {
    await select.first().selectOption(new RegExp(tag, "i"));
    return;
  }
  await page.getByRole("button", { name: new RegExp(tag, "i") }).first().click();
}

async function filterByTag(page: import("@playwright/test").Page, tag: string) {
  const control = page.getByRole("button", { name: new RegExp(tag, "i") });
  if ((await control.count()) > 0) {
    await control.last().click();
    return;
  }
  await page.getByRole("link", { name: new RegExp(tag, "i") }).last().click();
}

test("adds tags and filters by one tag", async ({ page }) => {
  await page.goto("/");

  await setTag(page, "Work");
  await addTodo(page, "Prepare release");
  await setTag(page, "Personal");
  await addTodo(page, "Call dentist");

  await expect(page.locator("li").filter({ hasText: "Prepare release" })).toContainText(/work/i);
  await expect(page.locator("li").filter({ hasText: "Call dentist" })).toContainText(/personal/i);

  await filterByTag(page, "Work");
  await expect(page.getByText("Prepare release")).toBeVisible();
  await expect(page.getByText("Call dentist")).toBeHidden();
});

test("tags persist after refresh", async ({ page }) => {
  await page.goto("/");

  await setTag(page, "Urgent");
  await addTodo(page, "Pay invoice");
  await page.reload();

  const row = page.locator("li").filter({ hasText: "Pay invoice" });
  await expect(row).toBeVisible();
  await expect(row).toContainText(/urgent/i);
});
`;

export const todoMvcEvolutionRemoveTagsSpec = `import { expect, test } from "@playwright/test";

test("tag UI is removed while core controls remain", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("textbox", { name: /new todo|what needs to be done/i })).toBeVisible();
  await expect(page.getByText(/work|personal|urgent/i)).toHaveCount(0);
  await expect(page.getByLabel(/tag/i)).toHaveCount(0);
});

test("legacy persisted todos with tags still load", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "todos",
      JSON.stringify([
        {
          id: "legacy-1",
          title: "Legacy tagged todo",
          completed: false,
          dueDate: "2026-08-15",
          tags: ["Work", "Urgent"]
        }
      ])
    );
  });
  await page.goto("/");

  await expect(page.getByText("Legacy tagged todo")).toBeVisible();
  await expect(page.getByText(/work|urgent/i)).toHaveCount(0);
});
`;

export const exampleSpec = `# Example Task

Placeholder task fixture. Replace this with a real benchmark task before running generation.
`;

export const exampleAcceptanceCriteria = `# Acceptance Criteria

- The app builds successfully.
- The app renders without a runtime error.
`;

export const exampleSemanticUi = `<screen name="Example" viewport="1440x900">
  <main>
    <title level="1">Example</title>
  </main>
</screen>
`;

export const exampleExpectedValues = `{
  "initial": {
    "visibleTitle": "Example"
  }
}
`;

export const defaultWeights = `initialQuality:
  buildRuntime: 0.25
  e2e: 0.35
  value: 0.15
  visual: 0.15
  promptAdherence: 0.10
`;

export const systemPromptS2 = `You are a coding agent building small frontend applications for a benchmark.

Prioritize simple, maintainable code. Keep behavior explicit, avoid unnecessary dependencies, and preserve the existing project structure. Make the smallest complete implementation that satisfies the task.
`;

export const userPromptU1 = `Build the requested application from the provided product spec and acceptance criteria.

Deliver a working React TypeScript implementation in the current scaffold.
`;

export const userPromptU3 = `Build the requested application from the provided product spec, acceptance criteria, and semantic UI reference.

Use the semantic UI tree as the structural reference for roles, labels, controls, and visible states. Deliver a working React TypeScript implementation in the current scaffold.
`;

export const userPromptU5 = `Build the requested application from the provided product spec, acceptance criteria, semantic UI reference, and expected values.

Maintainability requirements:
- keep state transitions clear;
- keep localStorage persistence isolated and testable;
- avoid duplicating filtering and counting logic;
- prefer small components only where they reduce real complexity;
- do not add libraries unless the task truly needs them.
`;

export const editPromptE2 = `Implement the requested change as the smallest maintainable change.

Preserve existing behavior unless the change explicitly replaces it. Do not rewrite the whole app for a local feature. Keep tests and package scripts runnable.
`;

export const scaffoldPackageJson = `{
  "name": "ape-vite-react-ts-scaffold",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.5",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@types/react": "^19.0.1",
    "@types/react-dom": "^19.0.2"
  }
}
`;

export const scaffoldGitignore = `node_modules/
dist/
*.tsbuildinfo
.ape-*.log
playwright-report/
test-results/
`;

export const scaffoldIndexHtml = `<html>
  <head>
    <title>APE Scaffold</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export const scaffoldMain = `import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app">
      <h1>APE Scaffold</h1>
      <p>Replace this placeholder during benchmark generation.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`;

export const scaffoldStyles = `body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f7f7f8;
  color: #171717;
}

.app {
  max-width: 720px;
  margin: 80px auto;
  padding: 0 24px;
}
`;

export const scaffoldTsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
`;
