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
  codeHealth: true

promptArms:
  user:
    - U1-structured

scoring:
  weights: scoring/weights.yaml

evolution: []
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
