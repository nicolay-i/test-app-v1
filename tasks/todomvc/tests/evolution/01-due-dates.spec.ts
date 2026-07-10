import { expect, test } from "@playwright/test";

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
  await expect(row).toContainText(/2026-08-15|Aug 15,? 2026|8\/15\/2026|15\.08\.2026/);
});

test("due dates persist and overdue active todos are marked", async ({ page }) => {
  await page.goto("/");

  await addTodo(page, "Reference active task");
  const dueDate = await dueDateInput(page);
  await dueDate.fill("2000-01-01");
  await addTodo(page, "Overdue task");
  await page.reload();

  const row = todoRow(page, "Overdue task");
  const referenceRow = todoRow(page, "Reference active task");
  await expect(row).toBeVisible();
  await expect(row).toContainText(/2000-01-01|Jan 1,? 2000|1\/1\/2000|01\.01\.2000/);
  const [overdueAppearance, referenceAppearance] = await Promise.all([
    visualSignature(row),
    visualSignature(referenceRow)
  ]);
  expect(overdueAppearance).not.toBe(referenceAppearance);
});

async function visualSignature(locator: import("@playwright/test").Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      style.color,
      style.backgroundColor,
      style.borderColor,
      style.fontWeight,
      style.fontStyle,
      style.textDecorationLine,
      style.opacity,
      style.outlineColor,
      style.boxShadow
    ].join("|");
  });
}
