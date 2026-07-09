import { expect, test } from "@playwright/test";

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
