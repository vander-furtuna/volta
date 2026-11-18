import "server-only";
import { z } from "zod";
import type {
  CwTokens,
  StoreCredentialsRepository,
  StoreInstallationRepository,
  StoredCredentials,
} from "@/application/ports";
import { decryptSecret, encryptSecret } from "@/server/security/token-encryption";
import { requireEnv, readEnv } from "@/server/config/env";
import { getServiceClient } from "./supabase";

/** Encryption key read at call time, so a missing key fails the operation, not the boot. */
function encryptionKey(): string {
  return requireEnv("TOKEN_ENCRYPTION_KEY", readEnv());
}

const storeIdSchema = z.string().uuid();

const credentialRowSchema = z.object({
  access_token_encrypted: z.string(),
  access_token_expires_at: z.string(),
  refresh_token_encrypted: z.string(),
  stores: z.object({ environment: z.enum(["sandbox", "production"]) }),
});

function expiryFrom(now: Date, expiresInSeconds: number): string {
  return new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
}

export const supabaseStoreInstallationRepository: StoreInstallationRepository = {
  async saveInstallation({ identity, environment, tokens, now }) {
    const key = encryptionKey();
    const { data, error } = await getServiceClient().rpc("upsert_store_installation", {
      p_external_id: identity.storeExternalId,
      p_name: identity.storeName,
      p_environment: environment,
      p_user_external_id: identity.userExternalId,
      p_user_name: identity.userName,
      p_user_email: identity.userEmail,
      p_access_token_encrypted: encryptSecret(tokens.accessToken, key),
      p_refresh_token_encrypted: encryptSecret(tokens.refreshToken, key),
      p_access_token_expires_at: expiryFrom(now, tokens.expiresInSeconds),
      p_scopes: identity.scopes,
      p_now: now.toISOString(),
    });
    if (error) throw error;
    return { storeId: storeIdSchema.parse(data) };
  },
};

export const supabaseStoreCredentialsRepository: StoreCredentialsRepository = {
  async acquireRefreshLock(storeId, now, leaseSeconds) {
    const { data, error } = await getServiceClient().rpc("acquire_store_refresh_lock", {
      p_store_id: storeId,
      p_now: now.toISOString(),
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    return data === true;
  },

  async load(storeId): Promise<StoredCredentials | null> {
    const { data, error } = await getServiceClient()
      .from("store_credentials")
      .select(
        "access_token_encrypted, access_token_expires_at, refresh_token_encrypted, stores!inner(environment)",
      )
      .eq("store_id", storeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const row = credentialRowSchema.parse(data);
    const key = encryptionKey();
    return {
      accessToken: decryptSecret(row.access_token_encrypted, key),
      accessTokenExpiresAt: new Date(row.access_token_expires_at),
      refreshToken: decryptSecret(row.refresh_token_encrypted, key),
      environment: row.stores.environment,
    };
  },

  async saveRefreshedAndRelease(storeId, tokens: CwTokens, now) {
    const key = encryptionKey();
    const { error } = await getServiceClient().rpc("save_store_tokens_and_release_lock", {
      p_store_id: storeId,
      p_access_token_encrypted: encryptSecret(tokens.accessToken, key),
      p_refresh_token_encrypted: encryptSecret(tokens.refreshToken, key),
      p_access_token_expires_at: expiryFrom(now, tokens.expiresInSeconds),
      p_now: now.toISOString(),
    });
    if (error) throw error;
  },

  async releaseRefreshLock(storeId) {
    const { error } = await getServiceClient().rpc("release_store_refresh_lock", {
      p_store_id: storeId,
    });
    if (error) throw error;
  },
};
