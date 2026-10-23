import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Reports"
      message="Reports appear once orders exist."
    />
  );
}
