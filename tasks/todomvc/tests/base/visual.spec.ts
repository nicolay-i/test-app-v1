import { expect, test } from "@playwright/test";

test("captures TodoMVC desktop shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /todos/i })).toBeVisible();
  await page.screenshot({ fullPage: true });
});
