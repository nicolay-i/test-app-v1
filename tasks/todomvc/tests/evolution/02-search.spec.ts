import { expect, test } from "@playwright/test";

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
  const link = page.getByRole("link", { name: new RegExp(`^${name}$`, "i") });
  if ((await link.count()) > 0) {
    await link.click();
    return;
  }
  await page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).click();
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
