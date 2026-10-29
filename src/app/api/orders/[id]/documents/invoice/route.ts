import type { NextRequest } from "next/server";
import { documentResponse, sendResponse } from "../pdf-response";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/documents/invoice">,
) {
  const { id } = await params;
  return documentResponse(request, id, { type: "invoice" });
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/documents/invoice">,
) {
  const { id } = await params;
  return sendResponse(request, id, { type: "invoice" });
}
