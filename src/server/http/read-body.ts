/** Webhook bodies from CW are small JSON objects. Anything larger is refused. */
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

/** Parses JSON, returning null instead of throwing, so callers can answer 400 for bad input. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class PayloadTooLargeError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Reads the request body as UTF-8 text, refusing bodies over `maxBytes`.
 * Checks the declared Content-Length first, then counts the bytes actually received,
 * because the header can be missing or wrong.
 */
export async function readBodyText(
  request: Request,
  maxBytes: number = MAX_WEBHOOK_BODY_BYTES,
): Promise<string> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
