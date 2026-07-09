import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";

export type MockTodoMvcVariant = "base" | "due-dates" | "search" | "tags" | "remove-tags";

export async function writeMockTodoMvc(workspacePath: string, variant: MockTodoMvcVariant = "base"): Promise<void> {
  const srcDir = path.join(workspacePath, "src");
  await ensureDir(srcDir);
  await writeFile(path.join(srcDir, "main.tsx"), mockMain(variant), "utf8");
  await writeFile(path.join(srcDir, "styles.css"), mockStyles, "utf8");
}

function mockMain(variant: MockTodoMvcVariant): string {
  const hasDueDates = variant !== "base";
  const hasSearch = variant === "search" || variant === "tags" || variant === "remove-tags";
  const hasTagControls = variant === "tags";
  const preservesLegacyTags = variant === "remove-tags";

  return `import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Filter = "all" | "active" | "completed";
type Tag = "Work" | "Personal" | "Urgent";

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  tags?: Tag[];
};

const storageKey = "todos";
const legacyStorageKey = "ape:todomvc";
const availableTags: Tag[] = ["Work", "Personal", "Urgent"];

function normalizeTodo(item: Partial<Todo>): Todo {
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    title: typeof item.title === "string" ? item.title : "",
    completed: Boolean(item.completed),
    dueDate: typeof item.dueDate === "string" ? item.dueDate : undefined,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is Tag => availableTags.includes(tag as Tag)) : []
  };
}

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTodo).filter((todo) => todo.title.trim()) : [];
  } catch {
    return [];
  }
}

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.completed) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(todo.dueDate).getTime() < today.getTime();
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [filter, setFilter] = useState<Filter>("all");
  const [dueDate, setDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<Tag | "all">("all");
  const activeCount = todos.filter((todo) => !todo.completed).length;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(todos));
  }, [todos]);

  const visibleTodos = useMemo(() => {
    return todos.filter((todo) => {
      if (filter === "active" && todo.completed) {
        return false;
      }
      if (filter === "completed" && !todo.completed) {
        return false;
      }
      if (${hasSearch} && search.trim() && !todo.title.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (${hasTagControls} && tagFilter !== "all" && !(todo.tags ?? []).includes(tagFilter as Tag)) {
        return false;
      }
      return true;
    });
  }, [filter, search, tagFilter, todos]);

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
        completed: false,
        dueDate: ${hasDueDates} && dueDate ? dueDate : undefined,
        tags: ${hasTagControls} ? selectedTags : []
      }
    ]);
    setDueDate("");
    setSelectedTags([]);
  }

  function toggleTodo(id: string, completed: boolean) {
    setTodos((current) => current.map((todo) => (todo.id === id ? { ...todo, completed } : todo)));
  }

  function toggleTag(tag: Tag, checked: boolean) {
    setSelectedTags((current) => (checked ? Array.from(new Set([...current, tag])) : current.filter((item) => item !== tag)));
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
        ${
          hasDueDates
            ? `<label className="field-label" htmlFor="due-date">
          Due date
        </label>
        <input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} />`
            : ""
        }
        ${
          hasTagControls
            ? `<fieldset className="tag-picker" aria-label="Tags">
          <legend>Tags</legend>
          {availableTags.map((tag) => (
            <label key={tag}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                aria-label={tag}
                onChange={(event) => toggleTag(tag, event.currentTarget.checked)}
              />
              {tag}
            </label>
          ))}
        </fieldset>`
            : ""
        }
      </form>

      ${
        hasSearch
          ? `<label className="sr-only" htmlFor="search-todos">
        Search todos
      </label>
      <input
        id="search-todos"
        role="searchbox"
        type="search"
        value={search}
        aria-label="Search"
        placeholder="Search todos"
        onChange={(event) => setSearch(event.currentTarget.value)}
      />`
          : ""
      }

      <ul className="todo-list">
        {visibleTodos.map((todo) => (
          <li key={todo.id} className={[todo.completed ? "completed" : "", ${hasDueDates} && isOverdue(todo) ? "overdue" : ""].filter(Boolean).join(" ")}>
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                aria-label={todo.title}
                onChange={(event) => toggleTodo(todo.id, event.currentTarget.checked)}
              />
              <span>{todo.title}</span>
            </label>
            ${hasDueDates ? `{todo.dueDate ? <time dateTime={todo.dueDate}>{todo.dueDate}</time> : null}` : ""}
            ${hasTagControls ? `{(todo.tags ?? []).length > 0 ? <span className="tags">{todo.tags!.join(", ")}</span> : null}` : ""}
            ${preservesLegacyTags ? "" : ""}
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
        ${
          hasTagControls
            ? `<nav aria-label="Tag filters" className="tag-filters">
          {availableTags.map((tag) => (
            <button key={tag} type="button" onClick={() => setTagFilter(tag)}>
              {tag}
            </button>
          ))}
        </nav>`
            : ""
        }
        <button type="button" onClick={removeCompleted}>
          Clear completed
        </button>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`;
}

const mockStyles = `body {
  margin: 0;
  background: #f5f5f5;
  color: #111827;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.todo-app {
  width: min(620px, calc(100vw - 32px));
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
footer,
#search-todos {
  background: white;
  box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
}

form {
  display: grid;
  gap: 10px;
  padding: 0 0 14px;
}

#new-todo,
#search-todos,
#due-date {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  padding: 16px 24px;
  font-size: 20px;
}

#search-todos {
  margin-top: 1px;
}

.field-label,
.tag-picker {
  margin: 0 24px;
  color: #4b5563;
  font-size: 14px;
}

.tag-picker {
  display: flex;
  gap: 14px;
  border: 0;
  padding: 0;
}

.tag-picker legend {
  margin-bottom: 6px;
}

.todo-list {
  list-style: none;
  margin: 1px 0 0;
  padding: 0;
}

.todo-list li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 14px;
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

.overdue {
  border-left: 4px solid #b91c1c;
}

time,
.tags {
  color: #6b7280;
  font-size: 14px;
}

footer {
  display: flex;
  flex-wrap: wrap;
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

a,
button {
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
