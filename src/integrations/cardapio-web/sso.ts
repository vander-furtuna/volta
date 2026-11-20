import { z } from "zod";
import type { SsoTicketResult, SsoTicketValidator } from "@/application/ports";
import { CwApiError, CwResponseError, createCwClient } from "./http-client";

/**
 * Validates the single-use ticket CW puts in the login_url when someone clicks "Acessar".
 * Source: https://docs.cardapioweb.com/cw-app-store/onboarding-e-acesso.md
 * and generated/identity.ts (identity-sso-tickets-validate).
 *
 * CW answers 401 for two different problems, told apart by the body:
 * - `{ valid: false, error: "invalid_ticket" }`: the ticket is unusable. Show the normal sign-in.
 * - `{ code: 4010 }`: the store's access token was refused. Renew it and try again.
 *
 * Never log the ticket or the token.
 */

export const SSO_VALIDATE_PATH = "/api/partner/v1/identity/sso_tickets/validate";

/** Ids may come as strings or numbers. */
const cwIdSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d{1,15}$/.test(value), { message: "id must be a positive integer" })
  .transform(Number);

const validTicketSchema = z.object({
  valid: z.boolean(),
  client_id: z.union([z.string(), z.number()]).transform(String).optional(),
  user: z.object({
    id: cwIdSchema,
    name: z.string().min(1).max(200),
    email: z.string().max(320).nullable().optional(),
  }),
  company: z.object({ id: cwIdSchema }),
});

const invalidTicketSchema = z.object({ valid: z.literal(false) });

/** A ticket is opaque; this only bounds its size before it is sent anywhere. */
export function isPlausibleSsoTicket(ticket: string): boolean {
  return ticket.length > 0 && ticket.length <= 512 && /^[\x21-\x7e]+$/.test(ticket);
}

export function createCwSsoTicketValidator(options: {
  /** The app's CW client_id. A ticket issued for another app is refused. */
  clientId: string;
  fetchImpl?: typeof fetch;
}): SsoTicketValidator {
  return {
    async validate(environment, accessToken, ticket): Promise<SsoTicketResult> {
      const client = createCwClient({ environment, accessToken, fetchImpl: options.fetchImpl });

      let body: z.infer<typeof validTicketSchema>;
      try {
        body = await client.post(SSO_VALIDATE_PATH, { ticket }, validTicketSchema);
      } catch (error) {
        if (error instanceof CwApiError && error.isUnauthorized) {
          return invalidTicketSchema.safeParse(error.body).success
            ? { status: "invalid_ticket" }
            : { status: "invalid_token" };
        }
        if (error instanceof CwResponseError) {
          // A 2xx without the documented shape: do not trust it as a sign-in.
          return { status: "invalid_ticket" };
        }
        throw error;
      }

      if (!body.valid) return { status: "invalid_ticket" };
      if (body.client_id !== undefined && body.client_id !== options.clientId) {
        return { status: "invalid_ticket" };
      }

      return {
        status: "valid",
        identity: {
          storeExternalId: body.company.id,
          userExternalId: body.user.id,
          userName: body.user.name,
          userEmail: body.user.email ?? null,
        },
      };
    },
  };
}
