import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CwApiError, CwResponseError, createCwClient } from "./http-client";

const schema = z.object({ id: z.number(), name: z.string() });

function clientReturning(status: number, body: unknown) {
  const calls: string[] = [];
  const fetchImpl = (async (url: URL | string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const client = createCwClient({ environment: "sandbox", accessToken: "t", fetchImpl });
  return { client, calls };
}

describe("createCwClient", () => {
  it("returns the body when it matches the schema", async () => {
    const { client } = clientReturning(200, { id: 1, name: "Loja" });
    await expect(client.get("/x", schema)).resolves.toEqual({ id: 1, name: "Loja" });
  });

  it("refuses a 2xx body that does not match the schema, without echoing it", async () => {
    const { client } = clientReturning(200, { id: "secret-customer-name", name: 5 });
    const error = await client.get("/x", schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CwResponseError);
    expect((error as Error).message).not.toContain("secret-customer-name");
  });

  it("refuses a 2xx response that is not JSON", async () => {
    const fetchImpl = (async () => new Response("<html>", { status: 200 })) as typeof fetch;
    const client = createCwClient({ environment: "sandbox", accessToken: "t", fetchImpl });
    await expect(client.get("/x", schema)).rejects.toBeInstanceOf(CwResponseError);
  });

  it("maps HTTP errors to CwApiError with the status", async () => {
    const { client } = clientReturning(401, { code: 4010, message: "Token inválido." });
    const error = await client.get("/x", schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CwApiError);
    expect((error as CwApiError).isUnauthorized).toBe(true);
  });

  it("sends the query string", async () => {
    const { client, calls } = clientReturning(200, { id: 1, name: "x" });
    await client.get("/x", schema, { page: 2, per_page: 20, unused: undefined });
    expect(calls[0]).toBe("https://integracao.sandbox.cardapioweb.com/x?page=2&per_page=20");
  });
});
