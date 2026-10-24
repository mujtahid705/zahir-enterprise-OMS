import type { Metadata } from "next";
import { PartyDetailPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Customer" };

export default function Page({ params }: PageProps<"/customers/[id]">) {
  return <PartyDetailPage kind="customer" params={params} />;
}
