import type { Metadata } from "next";
import { Suspense } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { Harness } from "./_proto/harness";

// PROTOTYPE: dashboard layout variants. ?role=staff hides money figures and the chart.
export const metadata: Metadata = { title: "Prototype: Dashboard" };

export default function Page() {
  return (
    <>
      <TopBar title="Dashboard" />
      <Suspense>
        <Harness />
      </Suspense>
    </>
  );
}
