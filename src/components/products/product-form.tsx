"use client";

import {
  useActionState,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { z } from "zod";
import {
  createProductAction,
  duplicateProductAction,
  updateProductAction,
} from "@/actions/products";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import {
  duplicateSchema,
  productEditSchema,
  productSchema,
  type ProductInput,
} from "@/lib/products";

export type Option = { id: string; code: string; name: string };
type Values = Partial<Record<keyof ProductInput, string | null>>;

// Create or edit a Product (SPEC §4.3). A new Product picks its Customer,
// unless the page fixed one; an existing Product keeps its Customer. The same
// Zod schema checks the form here and the input again in the service.
export function ProductForm({
  id,
  values,
  customer,
  customers,
  suppliers,
}: {
  id?: string;
  values?: Values;
  // Set when the Customer is fixed: editing, or adding from its Products tab.
  customer?: Option;
  customers: Option[];
  suppliers: Option[];
}) {
  const [state, action, pending] = useActionState(
    id ? updateProductAction.bind(null, id) : createProductAction,
    undefined,
  );
  const schema = id ? productEditSchema : productSchema;
  const field = (name: keyof ProductInput) => ({
    name,
    defaultValue: values?.[name] ?? "",
  });

  return (
    <ValidatedForm action={action} schema={schema} state={state}>
      {customer ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Customer</span>
          <p>
            {customer.code} {customer.name}
          </p>
          {!id && <input type="hidden" name="customerId" value={customer.id} />}
        </div>
      ) : (
        <Picker label="Customer" options={customers} {...field("customerId")} />
      )}
      <Specs values={values} suppliers={suppliers} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : id ? "Save changes" : "Add Product"}
      </Button>
    </ValidatedForm>
  );
}

// Supplier, specs and prices: everything but the Customer.
export function Specs({
  values,
  suppliers,
}: {
  values?: Values;
  suppliers: Option[];
}) {
  const field = (name: keyof ProductInput) => ({
    name,
    defaultValue: values?.[name] ?? "",
  });
  return (
    <>
      <Picker label="Supplier" options={suppliers} {...field("supplierId")} />
      <Field label="Name" required {...field("name")} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Size" {...field("size")} />
        <Field label="Thickness" {...field("thickness")} />
        <Field label="Colour" {...field("colour")} />
      </div>
      <Field label="Print details" multiline {...field("printDetails")} />
      <Field label="Description" multiline {...field("description")} />
      <Prices values={values} />
    </>
  );
}

// Duplicate for another customer: pick the Customer and set the Sell price;
// the Buy price comes pre-filled.
export function DuplicateForm({
  id,
  buyPrice,
  customers,
}: {
  id: string;
  buyPrice: string;
  customers: Option[];
}) {
  const [state, action, pending] = useActionState(
    duplicateProductAction.bind(null, id),
    undefined,
  );
  return (
    <ValidatedForm action={action} schema={duplicateSchema} state={state}>
      <Picker
        label="Customer"
        name="customerId"
        defaultValue=""
        options={customers}
      />
      <Prices values={{ buyPrice }} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Duplicate Product"}
      </Button>
    </ValidatedForm>
  );
}

export function ValidatedForm({
  action,
  schema,
  state,
  children,
}: {
  action: (formData: FormData) => void;
  schema: z.ZodType;
  state: FormState;
  children: ReactNode;
}) {
  const [clientError, setClientError] = useState<string>();

  function validate(event: FormEvent<HTMLFormElement>) {
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(input);
    setClientError(
      result.success ? undefined : result.error.issues[0]!.message,
    );
    if (!result.success) event.preventDefault();
  }

  return (
    <form
      action={action}
      onSubmit={validate}
      noValidate
      className="flex flex-col gap-5"
    >
      {children}
      <FormNotice state={clientError ? { error: clientError } : state} />
    </form>
  );
}

// Per piece, BDT (SPEC §4.4).
function Prices({ values }: { values?: Values }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Sell price per piece (Tk)"
        name="sellPrice"
        inputMode="decimal"
        required
        defaultValue={values?.sellPrice ?? ""}
      />
      <Field
        label="Buy price per piece (Tk)"
        name="buyPrice"
        inputMode="decimal"
        required
        defaultValue={values?.buyPrice ?? ""}
      />
    </div>
  );
}

// Ids come from useId: Next keeps the previous page mounted (hidden), so a
// fixed id would also match the form on the page just left.
function Picker({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Option[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue={defaultValue}>
        <option value="">Pick a {label}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.code} {option.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  inputMode,
  required = false,
  multiline = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  inputMode?: "decimal";
  required?: boolean;
  multiline?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {!required && (
          <span className="font-normal text-ink-subtle">(optional)</span>
        )}
      </Label>
      {multiline ? (
        <Textarea id={id} name={name} rows={2} defaultValue={defaultValue} />
      ) : (
        <Input
          id={id}
          name={name}
          inputMode={inputMode}
          className={inputMode && "num"}
          defaultValue={defaultValue}
        />
      )}
    </div>
  );
}
