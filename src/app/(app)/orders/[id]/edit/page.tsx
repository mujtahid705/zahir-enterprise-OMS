import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { OrderSteps, type OrderEdit } from "@/components/orders/order-steps";
import { TopBar } from "@/components/shell/top-bar";
import { requireRole } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { editBlock } from "@/lib/orders";
import { PERMISSIONS, can } from "@/lib/permissions";
import { orders, type OrderView } from "@/services/orders";
import { suppliers } from "@/services/parties";

export const metadata: Metadata = { title: "Edit Order" };

export default function Page({ params }: PageProps<"/orders/[id]/edit">) {
  return (
    <>
      <TopBar title="Edit Order" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <EditOrder params={params} />
        </Suspense>
      </main>
    </>
  );
}

// The Order as the Steps form opens it: each line with its own snapshot.
function editOf(order: OrderView, products: OrderEdit["products"]): OrderEdit {
  const supplierName = new Map(
    order.workOrders.map((wo) => [wo.supplierId, wo.supplierName]),
  );
  return {
    orderId: order.id,
    updatedAt: order.updatedAt?.toISOString() ?? null,
    customer: {
      id: order.customerId,
      code: "",
      name: order.customerName,
      phone: order.customerPhone,
      address: order.customerAddress,
    },
    products,
    lines: order.items.map((item) => ({
      itemId: item.id,
      id: item.productId,
      code: "",
      name: item.productName,
      specText: item.specText,
      sellPrice: item.sellPrice,
      buyPrice: item.buyPrice,
      supplier: {
        id: item.supplierId,
        name: supplierName.get(item.supplierId) ?? "",
      },
      supplierId: item.supplierId,
      quantity: item.quantity,
      listed: { sellPrice: item.sellPrice, buyPrice: item.buyPrice },
      deactivated: item.deactivated,
    })),
    details: {
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate ?? "",
      customerRef: order.customerRef ?? "",
      deliveryAddress: order.deliveryAddress,
      notes: order.notes ?? "",
      invoiceNote: order.invoiceNote ?? "",
    },
    letters: Object.fromEntries(
      order.workOrders
        .filter((wo) => wo.status !== "cancelled")
        .map((wo) => [wo.supplierId, wo.letter]),
    ),
    lettersUsed: order.woLettersUsed,
    workOrders: order.workOrders,
    challanSent: !!order.challanDownloadedAt,
  };
}

async function EditOrder({
  params,
}: {
  params: PageProps<"/orders/[id]/edit">["params"];
}) {
  const actor = await requireRole(...PERMISSIONS.editOrders);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await orders.get(actor, id);
  if (!order) notFound();

  const blocked = editBlock(order);
  if (blocked)
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="rounded-lg bg-canvas px-4 py-3 text-ink-muted">
          {blocked}
        </p>
        <Link
          href={`/orders/${id}`}
          className="inline-flex items-center gap-1 text-sm text-navy hover:underline"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
          Back to {order.orderNo}
        </Link>
      </div>
    );

  const addsProducts = can(actor.role, "addProductInline");
  const [products, supplierOptions] = await Promise.all([
    orders.productOptions(actor, order.customerId),
    addsProducts ? suppliers.options(actor) : null,
  ]);
  return (
    <OrderSteps
      customers={[]}
      today={todayInDhaka()}
      seesMargin={can(actor.role, "seeMargin")}
      overridesPrices={can(actor.role, "overridePrices")}
      suppliers={supplierOptions}
      edit={editOf(order, products)}
    />
  );
}
