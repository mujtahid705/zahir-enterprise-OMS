import { forbidden, notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { DocumentRef } from "@/lib/documents";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseCompanyAssets } from "@/lib/supabase/admin";
import { documents } from "@/services/documents";

const dateParam = z.iso.date().optional();

const isId = (id: string) => z.uuid().safeParse(id).success;

function checkIds(orderId: string, ref: DocumentRef) {
  if (!isId(orderId)) notFound();
  if (ref.type === "work_order" && !isId(ref.workOrderId)) notFound();
}

// GET for one document (SPEC §13.2): renders the PDF inline, with no side
// effects and nothing logged, for Preview and Share. `?date=YYYY-MM-DD`
// overrides the stored date.
export async function documentResponse(
  request: NextRequest,
  orderId: string,
  ref: DocumentRef,
): Promise<Response> {
  const actor = await requireRole(...PERMISSIONS.shareDocuments);
  checkIds(orderId, ref);
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

  return pdfResponse(result, "inline");
}

// POST for one document (SPEC §13.2): a Download, or a Share that completed,
// with body `{ date, via }`. Records it and moves the Order on; a Download
// answers with the PDF as an attachment, a Share with 204 (the browser
// already has the file). A broken rule (cancelled, dates locked) answers 409
// with the message to show.
export async function sendResponse(
  request: NextRequest,
  orderId: string,
  ref: DocumentRef,
): Promise<Response> {
  const actor = await requireRole(...PERMISSIONS.shareDocuments);
  checkIds(orderId, ref);
  const body: unknown = await request.json().catch(() => null);
  try {
    const result = await documents.send(actor, orderId, ref, body, {
      storage: supabaseCompanyAssets,
    });
    if (!result) notFound();
    if (!result.file) return new Response(null, { status: 204 });
    return pdfResponse(result.file, "attachment");
  } catch (error) {
    if (error instanceof UserInputError)
      return new Response(error.message, { status: 409 });
    if (error instanceof NotAllowedError) forbidden();
    throw error;
  }
}

function pdfResponse(
  { fileName, pdf }: { fileName: string; pdf: Buffer },
  disposition: "inline" | "attachment",
): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(disposition, fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// An ASCII name for old browsers, the exact one (RFC 5987) for the rest.
function contentDisposition(
  disposition: "inline" | "attachment",
  fileName: string,
): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
