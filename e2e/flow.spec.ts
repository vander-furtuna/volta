import { expect, test } from "@playwright/test";

// Happy path of the demo: home → audience → offer → review → coupon (inactive) → activate → mark sent.
// Draft state lives in sessionStorage, so each test starts from the fixture defaults.
// Text checks filter to visible matches: desktop and mobile layouts both render (one hidden by CSS)
// and Next keeps previously visited routes mounted but hidden.
test("creates an inactive coupon from the chosen audience and offer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Revisar público" }).click();
  await expect(page).toHaveURL(/\/campaigns\/new\/audience$/);

  // Audience: drop two customers.
  await page.getByRole("checkbox", { name: "Incluir Carla F. no público" }).uncheck();
  await page.getByRole("checkbox", { name: "Incluir Ana Paula R. no público" }).uncheck();
  await expect(page.getByText("36 clientes selecionados")).toBeVisible();
  await page.getByRole("link", { name: "Congelar público e continuar" }).click();
  await expect(page).toHaveURL(/\/campaigns\/new\/offer$/);

  // Offer: 15% with code VOLTA15.
  await page.getByRole("button", { name: /Percentual/ }).click();
  await page.getByRole("spinbutton", { name: "Percentual de desconto (%)" }).fill("15");
  await page.getByRole("textbox", { name: "Código do cupom" }).fill("VOLTA15");

  // Going back keeps the audience selection; going forward keeps the offer.
  await page.goBack();
  await expect(page.getByText("36 clientes selecionados")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Incluir Carla F. no público" }),
  ).not.toBeChecked();
  await page.goForward();
  await expect(page.getByRole("textbox", { name: "Código do cupom" })).toHaveValue("VOLTA15");

  await page.getByRole("link", { name: "Revisar antes de criar" }).click();
  await expect(page).toHaveURL(/\/campaigns\/new\/review$/);
  await expect(
    page.getByText(/Convidar 36 clientes .* com 15% de desconto/).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("VOLTA15", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alterar público" })).toHaveAttribute(
    "href",
    "/campaigns/new/audience",
  );

  await page.getByRole("button", { name: "Criar cupom na Cardápio Web" }).click();
  await expect(page).toHaveURL(/\/campaigns\/nov$/);

  // Coupon is created inactive; nothing is sent automatically.
  await expect(
    page.getByRole("heading", { name: /VOLTA15 criado, ainda desativado/ }),
  ).toBeVisible();
  await expect(page.getByText("Cupom criado, desativado").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Ativar cupom" }).click();
  await expect(page.getByText("Ativa, convite pendente").filter({ visible: true })).toBeVisible();

  await expect(
    page.getByText("O Volta não envia mensagens por você").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Convide os 36 clientes" })).toBeVisible();
  await page.getByRole("button", { name: "Marcar convites como enviados" }).click();
  await expect(
    page.getByText(/Convites marcados como enviados/).filter({ visible: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Acompanhar resultado" }).click();
  await expect(page).toHaveURL(/\/campaigns\/out\/results$/);
  await expect(page.getByRole("heading", { level: 1, name: "Volta de outubro" })).toBeVisible();
});

test("unknown campaign shows the not-found state", async ({ page }) => {
  await page.goto("/campaigns/xyz");
  await expect(
    page.getByRole("heading", { level: 1, name: "Não achamos essa campanha" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
});
