import type { NextRequest } from "next/server";
import { documentResponse } from "../pdf-response";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/documents/invoice">,
) {
  const { id } = await params;
  return documentResponse(request, id, { type: "invoice" });
}
