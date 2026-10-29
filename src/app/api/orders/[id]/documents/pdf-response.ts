import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { DocumentRef } from "@/lib/documents";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseCompanyAssets } from "@/lib/supabase/admin";
import { documents } from "@/services/documents";

const dateParam = z.iso.date().optional();

// GET for one document (SPEC §13.2): renders the PDF inline, with no side
// effects and nothing logged, for Preview and Share. `?date=YYYY-MM-DD`
// overrides the stored date.
export async function documentResponse(
  request: NextRequest,
  orderId: string,
  ref: DocumentRef,
): Promise<Response> {
  const actor = await requireRole(...PERMISSIONS.shareDocuments);
  const isId = (id: string) => z.uuid().safeParse(id).success;
  if (!isId(orderId)) notFound();
  if (ref.type === "work_order" && !isId(ref.workOrderId)) notFound();
  const date = dateParam.safeParse(
    request.nextUrl.searchParams.get("date") ?? undefined,
  );
  if (!date.success) {
    return new Response("Give the date as YYYY-MM-DD.", { status: 400 });
  }

  const result = await documents.render(actor, orderId, ref, {
    storage: supabaseCompanyAssets,
    date: date.data,
  });
  if (!result) notFound();

  return new Response(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": inline(result.fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// An ASCII name for old browsers, the exact one (RFC 5987) for the rest.
function inline(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
