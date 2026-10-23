import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <PlaceholderPage title="Activity" message="No activity yet" />;
}
