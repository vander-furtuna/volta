/**
 * Store access granted by CW billing (MARKETPLACE_APP_ACCESS_UPDATED).
 * Source: https://docs.cardapioweb.com/cobranca/assinaturas-e-acesso.md
 *
 * - `allowed: false` always blocks, even with a future `access_until`.
 * - `access_until` is exclusive: at that instant access has already ended, with no new event.
 * - `access_until: null` with `allowed: true` means no time limit (it does not mean blocked).
 * - No access state yet (installation still activating) blocks.
 */
export interface StoreAccess {
  allowed: boolean;
  accessUntil: Date | null;
}

export function isAccessAllowed(access: StoreAccess | null, now: Date): boolean {
  if (!access?.allowed) return false;
  return access.accessUntil === null || now.getTime() < access.accessUntil.getTime();
}
