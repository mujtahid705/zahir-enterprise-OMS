import type { NextRequest } from "next/server";
import { documentResponse, sendResponse } from "../../pdf-response";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/documents/wo/[woId]">,
) {
  const { id, woId } = await params;
  return documentResponse(request, id, {
    type: "work_order",
    workOrderId: woId,
  });
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/orders/[id]/documents/wo/[woId]">,
) {
  const { id, woId } = await params;
  return sendResponse(request, id, { type: "work_order", workOrderId: woId });
}
