import { describe, expect, it } from "vitest";
import type {
  CwIdentity,
  CwTokens,
  InstallationGateway,
  StoreInstallationRepository,
} from "@/application/ports";
import { installStore, MissingScopesError } from "./install-store";

const REQUIRED = ["auth", "customers", "orders", "coupons"] as const;
const tokens: CwTokens = { accessToken: "at", refreshToken: "rt", expiresInSeconds: 7200 };

function fakes(scopes: string[] = [...REQUIRED]) {
  const saved: unknown[] = [];
  const gateway: InstallationGateway = {
    async completeAuthorization() {
      const identity: CwIdentity = {
        storeExternalId: 123,
        storeName: "Loja Teste",
        userExternalId: 9,
        userName: "Maria",
        userEmail: null,
        scopes,
      };
      return { tokens, identity };
    },
  };
  const installations: StoreInstallationRepository = {
    async saveInstallation(input) {
      saved.push(input);
      return { storeId: "store-1" };
    },
  };
  return { gateway, installations, saved };
}

const input = {
  code: "code",
  codeVerifier: "verifier",
  environment: "sandbox" as const,
  now: new Date("2026-11-18T12:00:00Z"),
};

describe("installStore", () => {
  it("stores the installation when every required scope is granted", async () => {
    const deps = fakes();
    await expect(installStore(input, { ...deps, requiredScopes: REQUIRED })).resolves.toEqual({
      storeId: "store-1",
    });
    expect(deps.saved).toHaveLength(1);
  });

  it("refuses to store anything when a required scope is missing", async () => {
    const deps = fakes(["auth", "orders"]);
    const error = await installStore(input, { ...deps, requiredScopes: REQUIRED }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(MissingScopesError);
    expect((error as MissingScopesError).missingScopes).toEqual(["customers", "coupons"]);
    expect(deps.saved).toHaveLength(0);
  });
});
