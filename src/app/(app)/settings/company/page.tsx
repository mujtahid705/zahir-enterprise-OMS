import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Company settings" };

export default function Page() {
  return <EmptyState message="Company settings are not built yet." />;
}
