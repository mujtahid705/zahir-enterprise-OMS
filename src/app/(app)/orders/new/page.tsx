import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderSteps } from "@/components/orders/order-steps";
import { TopBar } from "@/components/shell/top-bar";
import { requireRole } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { PERMISSIONS, can } from "@/lib/permissions";
import { orders } from "@/services/orders";

export const metadata: Metadata = { title: "New Order" };

export default function Page() {
  return (
    <>
      <TopBar title="New Order" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <NewOrder />
        </Suspense>
      </main>
    </>
  );
}

async function NewOrder() {
  const actor = await requireRole(...PERMISSIONS.editOrders);
  const customers = await orders.customerOptions(actor);
  return (
    <OrderSteps
      customers={customers}
      today={todayInDhaka()}
      seesMargin={can(actor.role, "seeMargin")}
    />
  );
}
