import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";

export async function writeMockTodoMvc(workspacePath: string): Promise<void> {
  const srcDir = path.join(workspacePath, "src");
  await ensureDir(srcDir);
  await writeFile(path.join(srcDir, "main.tsx"), mockMain, "utf8");
  await writeFile(path.join(srcDir, "styles.css"), mockStyles, "utf8");
}

const mockMain = `import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Filter = "all" | "active" | "completed";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

const storageKey = "ape:todomvc";

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Todo[]) : [];
  } catch {
    return [];
  }
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [filter, setFilter] = useState<Filter>("all");
  const activeCount = todos.filter((todo) => !todo.completed).length;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(todos));
  }, [todos]);

  const visibleTodos = useMemo(() => {
    if (filter === "active") {
      return todos.filter((todo) => !todo.completed);
    }
    if (filter === "completed") {
      return todos.filter((todo) => todo.completed);
    }
    return todos;
  }, [filter, todos]);

  function addTodo(title: string) {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    setTodos((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: trimmed,
        completed: false
      }
    ]);
  }

  function toggleTodo(id: string, completed: boolean) {
    setTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, completed } : todo)));
  }

  function removeCompleted() {
    setTodos((current) => current.filter((todo) => !todo.completed));
  }

  return (
    <main className="todo-app" aria-label="TodoMVC">
      <h1>todos</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("new-todo") as HTMLInputElement;
          addTodo(input.value);
          input.value = "";
        }}
      >
        <label className="sr-only" htmlFor="new-todo">
          New todo
        </label>
        <input id="new-todo" name="new-todo" placeholder="What needs to be done?" autoFocus />
      </form>

      <ul className="todo-list">
        {visibleTodos.map((todo) => (
          <li key={todo.id} className={todo.completed ? "completed" : ""}>
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                aria-label={todo.title}
                onChange={(event) => toggleTodo(todo.id, event.currentTarget.checked)}
              />
              <span>{todo.title}</span>
            </label>
          </li>
        ))}
      </ul>

      <footer>
        <span>{activeCount === 1 ? "1 item left" : \`\${activeCount} items left\`}</span>
        <nav aria-label="Todo filters">
          <a href="#/" aria-current={filter === "all" ? "page" : undefined} onClick={() => setFilter("all")}>
            All
          </a>
          <a href="#/active" aria-current={filter === "active" ? "page" : undefined} onClick={() => setFilter("active")}>
            Active
          </a>
          <a
            href="#/completed"
            aria-current={filter === "completed" ? "page" : undefined}
            onClick={() => setFilter("completed")}
          >
            Completed
          </a>
        </nav>
        <button type="button" onClick={removeCompleted}>
          Clear completed
        </button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`;

const mockStyles = `body {
  margin: 0;
  background: #f5f5f5;
  color: #111827;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.todo-app {
  width: min(550px, calc(100vw - 32px));
  margin: 56px auto;
}

h1 {
  margin: 0 0 20px;
  color: #b83f45;
  font-size: 72px;
  font-weight: 200;
  text-align: center;
}

form,
.todo-list,
footer {
  background: white;
  box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
}

#new-todo {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  padding: 20px 24px;
  font-size: 24px;
}

.todo-list {
  list-style: none;
  margin: 1px 0 0;
  padding: 0;
}

.todo-list li {
  border-top: 1px solid #ededed;
  padding: 16px 20px;
  font-size: 22px;
}

.todo-list label {
  display: flex;
  align-items: center;
  gap: 14px;
}

.todo-list input {
  width: 22px;
  height: 22px;
}

.completed span {
  color: #949494;
  text-decoration: line-through;
}

footer {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 16px;
  margin-top: 1px;
  padding: 12px 16px;
  color: #4b5563;
  font-size: 14px;
}

nav {
  display: flex;
  gap: 8px;
}

a,
button {
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: none;
}

a {
  padding: 3px 7px;
}

a[aria-current="page"] {
  border-color: #d1a9a9;
}

button {
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
`;
