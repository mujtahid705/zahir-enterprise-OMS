import type { Metadata } from "next";
import { EditPartyPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Edit Customer" };

export default function Page({ params }: PageProps<"/customers/[id]/edit">) {
  return <EditPartyPage kind="customer" params={params} />;
}
