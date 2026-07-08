import { expect, test } from "@playwright/test";

test("does not create empty todos and persists state", async ({ page }) => {
  await page.goto("/");

  const input = page.getByRole("textbox", { name: /new todo|what needs to be done/i });
  await input.press("Enter");
  await expect(page.getByText(/0 items left|0 item left/i)).toBeVisible();

  await input.fill("Persisted task");
  await input.press("Enter");
  await page.reload();

  await expect(page.getByText("Persisted task")).toBeVisible();
  await expect(page.getByText(/1 item left/i)).toBeVisible();
});
