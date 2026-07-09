import { expect, test } from "@playwright/test";

async function toggleTodo(page: import("@playwright/test").Page, title: string) {
  await page.locator("li").filter({ hasText: title }).getByRole("checkbox").check();
}

async function clickFilter(page: import("@playwright/test").Page, name: string) {
  const link = page.getByRole("link", { name: new RegExp(`^${name}$`, "i") });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).click();
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
