import { field } from "@/lib/form-state";
import type { ProductEditInput } from "@/lib/products";

// Shared by the Product actions and the order form's "+ New product". Not a
// "use server" file, so it may export a plain function.

// The specs and prices a product form posts.
export function productInputFrom(formData: FormData): ProductEditInput {
  return {
    supplierId: field(formData, "supplierId"),
    name: field(formData, "name"),
    size: field(formData, "size"),
    thickness: field(formData, "thickness"),
    colour: field(formData, "colour"),
    printDetails: field(formData, "printDetails"),
    description: field(formData, "description"),
    sellPrice: field(formData, "sellPrice"),
    buyPrice: field(formData, "buyPrice"),
  };
}
