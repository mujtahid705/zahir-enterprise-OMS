import type { Metadata } from "next";
import { DuplicateProductPage } from "@/components/products/product-pages";

export const metadata: Metadata = { title: "Duplicate Product" };

export default function Page({
  params,
}: PageProps<"/products/[id]/duplicate">) {
  return <DuplicateProductPage params={params} />;
}
