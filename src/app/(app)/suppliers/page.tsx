import type { Metadata } from "next";
import { PartyListPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page({ searchParams }: PageProps<"/suppliers">) {
  return <PartyListPage kind="supplier" searchParams={searchParams} />;
}
