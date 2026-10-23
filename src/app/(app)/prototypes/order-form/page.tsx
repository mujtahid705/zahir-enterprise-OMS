import type { Metadata } from "next";
import { Suspense } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { Harness } from "./_proto/harness";

// PROTOTYPE: order form variants. Not linked from the app. ?role=staff hides margin.
export const metadata: Metadata = { title: "Prototype: New Order" };

export default function Page() {
  return (
    <>
      <TopBar title="New Order" />
      <Suspense>
        <Harness />
      </Suspense>
    </>
  );
}
