import { test, expect } from "@playwright/test";

test("abre o login sem tela travada", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#auth-page")).toBeVisible();
  await expect(page.locator("#auth-submit")).toBeVisible();
  await expect(page.locator("#auth-email")).toBeVisible();
});

test("abre cadastro público de treinador", async ({ page }) => {
  await page.goto("/?signup=coach");
  await expect(page.locator("#signup-panel")).toBeVisible();
  await expect(page.locator("#signup-name")).toBeVisible();
  await expect(page.locator("#signup-cpf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar teste grátis" })).toBeVisible();
});
