import type { Metadata } from "next";
import { ReportPage } from "@/components/reports/report-page";

export const metadata: Metadata = { title: "Reports" };

export default function Page({ searchParams }: PageProps<"/reports">) {
  return <ReportPage searchParams={searchParams} />;
}
