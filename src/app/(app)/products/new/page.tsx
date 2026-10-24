import type { Metadata } from "next";
import { NewProductPage } from "@/components/products/product-pages";

export const metadata: Metadata = { title: "Add Product" };

export default function Page({ searchParams }: PageProps<"/products/new">) {
  return <NewProductPage searchParams={searchParams} />;
}
