import type { Metadata } from "next";
import { NewPartyPage } from "@/components/parties/party-pages";

export const metadata: Metadata = { title: "Add Customer" };

export default function Page() {
  return <NewPartyPage kind="customer" />;
}
