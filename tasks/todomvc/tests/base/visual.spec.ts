import { expect, test } from "@playwright/test";

test("captures TodoMVC desktop shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("todomvc-desktop.png", { fullPage: true });
});
