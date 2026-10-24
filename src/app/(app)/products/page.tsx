import type { Metadata } from "next";
import { ProductListPage } from "@/components/products/product-pages";

export const metadata: Metadata = { title: "Products" };

export default function Page({ searchParams }: PageProps<"/products">) {
  return <ProductListPage searchParams={searchParams} />;
}
