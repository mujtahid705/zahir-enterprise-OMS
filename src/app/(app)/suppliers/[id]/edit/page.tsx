import type { Metadata } from "next";
import { EditPartyPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Edit Supplier" };

export default function Page({ params }: PageProps<"/suppliers/[id]/edit">) {
  return <EditPartyPage kind="supplier" params={params} />;
}
