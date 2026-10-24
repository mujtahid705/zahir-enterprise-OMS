"use client";

import { useActionState, useId, useState, type FormEvent } from "react";
import { createPartyAction, updatePartyAction } from "@/actions/parties";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PARTY, type PartyInput, type PartyKind } from "@/lib/parties";

// Create or edit a Customer or Supplier. The same Zod schema checks the form
// here and the input again in the service.
export function PartyForm({
  kind,
  id,
  values,
}: {
  kind: PartyKind;
  id?: string;
  values?: Partial<Record<keyof PartyInput, string | null>>;
}) {
  const { label, schema } = PARTY[kind];
  const [state, action, pending] = useActionState(
    id
      ? updatePartyAction.bind(null, kind, id)
      : createPartyAction.bind(null, kind),
    undefined,
  );
  const [clientError, setClientError] = useState<string>();

  function validate(event: FormEvent<HTMLFormElement>) {
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(input);
    setClientError(
      result.success ? undefined : result.error.issues[0]!.message,
    );
    if (!result.success) event.preventDefault();
  }

  const field = (name: keyof PartyInput) => ({
    name,
    defaultValue: values?.[name] ?? "",
  });

  return (
    <form
      action={action}
      onSubmit={validate}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field label="Name" required {...field("name")} />
      <Field label="Contact person" {...field("contactPerson")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" type="tel" required {...field("phone")} />
        <Field
          label="WhatsApp"
          type="tel"
          required={PARTY[kind].whatsappRequired}
          {...field("whatsapp")}
        />
      </div>
      <Field label="Email" type="email" {...field("email")} />
      <Field label="Address" multiline required {...field("address")} />
      <Field label="Notes" multiline {...field("notes")} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : id ? "Save changes" : `Add ${label}`}
      </Button>
      <FormNotice state={clientError ? { error: clientError } : state} />
    </form>
  );
}

// Ids come from useId: Next keeps the previous page mounted (hidden), so a
// fixed id would also match the form on the page just left.
function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  multiline = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: "text" | "tel" | "email";
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
        <Textarea id={id} name={name} rows={3} defaultValue={defaultValue} />
      ) : (
        <Input id={id} name={name} type={type} defaultValue={defaultValue} />
      )}
    </div>
  );
}
