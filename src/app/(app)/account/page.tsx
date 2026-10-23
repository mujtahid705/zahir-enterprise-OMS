import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Account" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Account"
      message="Account settings are not built yet."
    />
  );
}
