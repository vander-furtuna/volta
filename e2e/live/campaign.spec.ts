import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { campaignId, foreignCampaignId, startPartnerFixtures } from "./partners-fixture";

test("isolates stores, reconciles coupon creation and reports synced orders", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Set the app URL in playwright.live.config.ts");
  const fixture = await startPartnerFixtures(baseURL);
  const review = `/campaigns/new/review?campaign=${campaignId}`;

  try {
    await page.goto(review);
    await expect(page.getByRole("heading", { name: "Acesse pela Cardápio Web" })).toBeVisible();

    const start = await page.request.get("/api/cw/oauth/start", { maxRedirects: 0 });
    expect(start.status()).toBe(307);
    const authorization = new URL(start.headers().location ?? "");
    expect(authorization.origin + authorization.pathname).toBe(fixture.portal);
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("client_id")).toBe("volta-fixture");
    const callback = new URL(authorization.searchParams.get("redirect_uri") ?? "");
    expect(callback.origin).toBe(baseURL);
    callback.searchParams.set("code", "fixture-oauth-code");
    callback.searchParams.set("state", authorization.searchParams.get("state") ?? "");
    await page.goto(callback.toString());
    expect(fixture.errors).toEqual([]);
    await expect(page.getByRole("heading", { name: "Campanhas de recompra" })).toBeVisible();

    await page.goto(`/campaigns/new/review?campaign=${foreignCampaignId}`);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar cupom na Cardápio Web" })).toHaveCount(0);

    await page.goto(review);
    const create = page.getByRole("button", { name: "Criar cupom na Cardápio Web" });
    const alert = page.locator("form").getByRole("alert");
    await expect(create).toBeVisible();
    fixture.access.access_until = "2000-01-01T00:00:00+00:00";
    await create.click();
    await expect(alert).toHaveText("Abra o Volta pela Cardápio Web para continuar.");
    expect(fixture.requests).toHaveLength(0);
    fixture.access.access_until = null;

    await create.click();
    await expect(alert).toContainText("O rascunho está salvo");
    await expect.poll(() => fixture.requests.length).toBe(1);

    await create.click();
    await expect.poll(() => fixture.requests.length).toBe(2);
    await expect(alert).toContainText("O rascunho está salvo");

    await create.click();
    await expect(page).toHaveURL(`/campaigns/${campaignId}`);
    expect(fixture.requests).toHaveLength(2);
    await expect(page.getByText("Cupom criado, desativado")).toBeVisible();

    await page.getByRole("button", { name: "Ativar cupom" }).click();
    await page.getByRole("button", { name: "Marcar convites como enviados" }).click();
    await expect(page.getByText("Ativa, convites enviados")).toBeVisible();

    await page.getByRole("link", { name: "Ver resultados" }).click();
    await expect(page.getByRole("heading", { name: "Aguardando sincronização" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Uso do cupom" })).toHaveCount(0);

    fixture.addOrder(101, false);
    await page.reload();
    await expect(
      page.getByText("Nenhum uso registrado nos pedidos concluídos sincronizados."),
    ).toBeVisible();

    fixture.addOrder(102, true);
    await page.reload();
    await expect(
      page.getByText("O cupom foi usado em 1 pedido concluído sincronizado."),
    ).toBeVisible();
    await expect(page.getByText("Nº 102", { exact: false })).toBeVisible();
    await expect(page.getByText("1 de 1 convidado voltou a pedir.")).toBeVisible();
    expect(fixture.errors).toEqual([]);

    const template = await page.context().newPage();
    for (const [width, height, file] of [
      [1440, 900, "results"],
      [390, 844, "mobile-results"],
    ] as const) {
      const viewport = { width, height };
      await page.setViewportSize(viewport);
      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`results-${width}.png`),
      });
      await template.setViewportSize(viewport);
      await template.goto(pathToFileURL(resolve("design/templates/html", `${file}.html`)).href);
      await template.screenshot({
        fullPage: true,
        path: test.info().outputPath(`template-${width}.png`),
      });
    }
    await template.close();
  } finally {
    await fixture.close();
  }
});
