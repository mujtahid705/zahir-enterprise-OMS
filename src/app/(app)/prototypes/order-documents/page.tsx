import type { Metadata } from "next";
import { Suspense } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { Harness } from "./_proto/harness";

// PROTOTYPE: documents panel variants on the order detail page. ?role=staff, ?s=<scenario>.
export const metadata: Metadata = { title: "Prototype: Order documents" };

export default function Page() {
  return (
    <>
      <TopBar title="ORD-2026-0012" />
      <Suspense>
        <Harness />
      </Suspense>
    </>
  );
}
