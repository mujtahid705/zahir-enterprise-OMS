import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/products/product-pages";

export const metadata: Metadata = { title: "Product" };

export default function Page({ params }: PageProps<"/products/[id]">) {
  return <ProductDetailPage params={params} />;
}
