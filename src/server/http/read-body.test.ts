import { describe, expect, it } from "vitest";
import { PayloadTooLargeError, parseJson, readBodyText } from "./read-body";

describe("parseJson", () => {
  it("parses valid JSON and returns null for invalid JSON", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson("{not json")).toBeNull();
    expect(parseJson("")).toBeNull();
  });
});

describe("readBodyText", () => {
  it("returns the body text when it is within the limit", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: '{"a":1}' });
    await expect(readBodyText(request, 100)).resolves.toBe('{"a":1}');
  });

  it("returns an empty string when there is no body", async () => {
    const request = new Request("http://localhost/x", { method: "GET" });
    await expect(readBodyText(request, 100)).resolves.toBe("");
  });

  it("refuses a body whose declared Content-Length is over the limit", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-length": "500" },
      body: "x".repeat(10),
    });
    await expect(readBodyText(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("refuses a body that grows over the limit even without a Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(60)));
        controller.enqueue(new TextEncoder().encode("x".repeat(60)));
        controller.close();
      },
    });
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBodyText(request, 100)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
