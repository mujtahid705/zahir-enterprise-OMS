"use client";

import { useActionState } from "react";
import {
  updateCompanyDetailsAction,
  uploadCompanyImageAction,
} from "@/actions/company-settings";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyImageKind } from "@/lib/company-image";
import type { CompanySettings } from "@/services/company-settings";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function DetailsForm({
  settings,
}: {
  settings: CompanySettings | undefined;
}) {
  const [state, action, pending] = useActionState(
    updateCompanyDetailsAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <h3 className="section-label">Letterhead</h3>
      <Field id="name" label="Company name">
        <Input
          id="name"
          name="name"
          defaultValue={settings?.name ?? ""}
          autoComplete="organization"
          required
        />
      </Field>
      <Field id="address" label="Address">
        <Textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={settings?.address ?? ""}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label="Phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={settings?.phone ?? ""}
          />
        </Field>
        <Field id="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={settings?.email ?? ""}
          />
        </Field>
      </div>
      <Field id="paymentInstructions" label="Payment instructions">
        <Textarea
          id="paymentInstructions"
          name="paymentInstructions"
          rows={3}
          placeholder="Bank or bKash details, printed on the Invoice"
          defaultValue={settings?.paymentInstructions ?? ""}
        />
      </Field>
      <Field id="defaultWoNote" label="Default WO note">
        <Textarea
          id="defaultWoNote"
          name="defaultWoNote"
          rows={3}
          placeholder="Pre-filled on every new Work Order"
          defaultValue={settings?.defaultWoNote ?? ""}
        />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save details"}
      </Button>
      <FormNotice state={state} />
    </form>
  );
}

export function ImageForm({
  kind,
  title,
  hint,
  accept,
  src,
  isDefault = false,
}: {
  kind: CompanyImageKind;
  title: string;
  hint: string;
  accept: string;
  src: string | undefined;
  isDefault?: boolean;
}) {
  const [state, action, pending] = useActionState(
    uploadCompanyImageAction.bind(null, kind),
    undefined,
  );
  const inputId = `${kind}-file`;
  return (
    <form action={action} className="flex flex-col gap-3">
      <h3 className="section-label">{title}</h3>
      <div className="flex h-28 items-center justify-center rounded-lg border border-border bg-surface p-4">
        {src ? (
          // Served by our own route from the private bucket; not optimised.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={isDefault ? `Current ${kind} (default)` : `Current ${kind}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-ink-subtle">No {kind} uploaded yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor={inputId} className="sr-only">
            {`${title} file`}
          </Label>
          <Input
            id={inputId}
            name="file"
            type="file"
            accept={accept}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Uploading…" : `Upload ${kind}`}
        </Button>
      </div>
      <p className="text-xs text-ink-muted">{hint}</p>
      <FormNotice state={state} />
    </form>
  );
}
