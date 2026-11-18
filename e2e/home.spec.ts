import { expect, test } from "@playwright/test";

test("home shows the repurchase opportunity", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("clientes frequentes");
  await expect(page.getByRole("link", { name: "Revisar público" })).toBeVisible();
});
