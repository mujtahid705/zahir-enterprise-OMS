import type { Metadata } from "next";
import { OrderDetailPage } from "@/components/orders/order-detail";

export const metadata: Metadata = { title: "Order" };

export default function Page({ params }: PageProps<"/orders/[id]">) {
  return <OrderDetailPage params={params} />;
}
