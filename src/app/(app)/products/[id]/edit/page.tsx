import type { Metadata } from "next";
import { EditProductPage } from "@/components/products/product-pages";

export const metadata: Metadata = { title: "Edit Product" };

export default function Page({ params }: PageProps<"/products/[id]/edit">) {
  return <EditProductPage params={params} />;
}
