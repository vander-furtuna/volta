import "server-only";
import { cookies } from "next/headers";
import { connection, type NextResponse } from "next/server";
import { z } from "zod";
import { isAccessAllowed } from "@/domain/access/store-access";
import { readEnv, requireEnv } from "@/server/config/env";
import { getServiceClient } from "@/server/database/supabase";
import {
  signStoreSession,
  STORE_SESSION_SECONDS,
  verifyStoreSession,
  type StoreSessionIdentity,
} from "./store-session-token";

const COOKIE_NAME = "volta_session";
const memberSchema = z.object({
  id: z.uuid(),
  stores: z.object({
    name: z.string(),
    uninstalled_at: z.string().nullable(),
    store_access: z
      .object({
        allowed: z.boolean(),
        access_until: z.iso.datetime({ offset: true }).nullable(),
      })
      .nullable(),
  }),
});

export function setStoreSession(response: NextResponse, identity: StoreSessionIdentity) {
  response.cookies.set(COOKIE_NAME, signStoreSession(identity, requireEnv("SESSION_SECRET")), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STORE_SESSION_SECONDS,
  });
}

export async function getStoreSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token) await connection();
  const identity = verifyStoreSession(token, readEnv().SESSION_SECRET);
  if (!identity) return { status: "unauthenticated" } as const;

  const { data, error } = await getServiceClient()
    .from("users")
    .select("id, stores!inner(name, uninstalled_at, store_access(allowed, access_until))")
    .eq("store_id", identity.storeId)
    .eq("external_id", identity.userExternalId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { status: "unauthenticated" } as const;

  const member = memberSchema.parse(data);
  const store = member.stores;
  const access = store.store_access;
  if (
    store.uninstalled_at !== null ||
    !isAccessAllowed(
      access && {
        allowed: access.allowed,
        accessUntil: access.access_until === null ? null : new Date(access.access_until),
      },
      new Date(),
    )
  ) {
    return { status: "blocked" } as const;
  }

  return {
    status: "authenticated",
    storeId: identity.storeId,
    userId: member.id,
    storeName: store.name,
  } as const;
}
