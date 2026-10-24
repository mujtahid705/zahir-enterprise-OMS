import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Landing for emailed links (password reset). Accepts the token-hash link
// (works on any device) and the PKCE code link (same browser only), then
// continues to `next` with a session.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createSupabaseServerClient();
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("Missing token") };

  const target = error ? "/forgot-password?expired=1" : next;
  return NextResponse.redirect(new URL(target, request.url));
}
