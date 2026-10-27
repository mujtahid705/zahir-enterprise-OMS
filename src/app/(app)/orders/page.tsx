import type { Metadata } from "next";
import { OrderListPage } from "@/components/orders/order-list";

export const metadata: Metadata = { title: "Orders" };

export default function Page({ searchParams }: PageProps<"/orders">) {
  return <OrderListPage searchParams={searchParams} />;
}
