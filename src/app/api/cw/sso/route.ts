import { NextResponse, type NextRequest } from "next/server";

/**
 * Target of the "Acessar" button in the CW portal: `?ticket=ST-...&company_external_id=123`.
 * The single-use ticket must be validated on the server with the store's own access token:
 * POST /api/partner/v1/identity/sso_tickets/validate { ticket } (scope `auth`).
 * Never reuse a rejected ticket; show the regular sign-in instead.
 */
export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  const storeExternalId = request.nextUrl.searchParams.get("company_external_id");

  if (!ticket || !storeExternalId) {
    return NextResponse.json({ error: "missing_ticket" }, { status: 400 });
  }

  // TODO(sso): load the store installation, refresh its token if needed, validate the ticket,
  // find or create the user by `user.id` and set the session cookie.
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
