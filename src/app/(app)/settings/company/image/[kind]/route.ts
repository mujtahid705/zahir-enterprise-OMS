import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isCompanyImageKind } from "@/lib/company-image";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseCompanyAssets } from "@/lib/supabase/admin";
import { readCompanyImage } from "@/services/company-settings";

// Streams the uploaded logo or signature from the private bucket to an Admin,
// so the browser never needs bucket credentials (SPEC §13.1). An SVG is
// sandboxed, so opened directly it can't run script on our origin.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/settings/company/image/[kind]">,
) {
  const { kind } = await params;
  if (!isCompanyImageKind(kind)) notFound();
  const actor = await requireRole(...PERMISSIONS.editCompanySettings);

  const image = await readCompanyImage(actor, kind, {
    storage: supabaseCompanyAssets,
  });
  if (!image) notFound();

  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-cache",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
