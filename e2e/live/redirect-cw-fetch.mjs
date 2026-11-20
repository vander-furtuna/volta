// Loaded only by the Playwright server. Redirect its CW sandbox requests to the fixture.
const realFetch = globalThis.fetch;
const fixture = new URL(process.env.SUPABASE_URL);

if (fixture.hostname !== "127.0.0.1") {
  throw new Error("The integration test requires a loopback fixture");
}

globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin === "https://integracao.sandbox.cardapioweb.com") {
    const target = new URL(url.pathname + url.search, fixture);
    return realFetch(input instanceof Request ? new Request(target, input) : target, init);
  }
  if (url.hostname.endsWith(".cardapioweb.com")) {
    throw new Error("Unexpected Cardápio Web request in an integration test");
  }
  return realFetch(input, init);
};
