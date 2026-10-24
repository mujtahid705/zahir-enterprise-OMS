import type { Metadata } from "next";
import { PartyDetailPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Supplier" };

export default function Page({
  params,
  searchParams,
}: PageProps<"/suppliers/[id]">) {
  return (
    <PartyDetailPage
      kind="supplier"
      params={params}
      searchParams={searchParams}
    />
  );
}
