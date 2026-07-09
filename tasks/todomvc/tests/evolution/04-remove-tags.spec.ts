import { expect, test } from "@playwright/test";

test("tag UI is removed while core controls remain", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("textbox", { name: /new todo|what needs to be done/i })).toBeVisible();
  await expect(page.getByText(/work|personal|urgent/i)).toHaveCount(0);
  await expect(page.getByLabel(/tag/i)).toHaveCount(0);
});

test("legacy persisted todos with tags still load", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "todos",
      JSON.stringify([
        {
          id: "legacy-1",
          title: "Legacy tagged todo",
          completed: false,
          dueDate: "2026-08-15",
          tags: ["Work", "Urgent"]
        }
      ])
    );
  });
  await page.goto("/");

  await expect(page.getByText("Legacy tagged todo")).toBeVisible();
  await expect(page.getByText(/work|urgent/i)).toHaveCount(0);
});
