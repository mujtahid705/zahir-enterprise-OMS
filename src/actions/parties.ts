"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { field, formAction, type FormState } from "@/lib/form-state";
import {
  PARTY,
  PARTY_KINDS,
  type PartyInput,
  type PartyKind,
} from "@/lib/parties";
import { PERMISSIONS } from "@/lib/permissions";
import { PARTY_SERVICES } from "@/services/parties";

// Customers and Suppliers (SPEC §3): Admin/Manager write, Admin deletes. The
// service checks the role again. `kind` is bound by the page, so it is
// re-checked here like any other client input.

function serviceFor(kind: PartyKind) {
  return PARTY_SERVICES[z.enum(PARTY_KINDS).parse(kind)];
}

const asEditor = () => requireRole(...PERMISSIONS.manageMasterData);

function inputFrom(formData: FormData): PartyInput {
  return {
    name: field(formData, "name"),
    contactPerson: field(formData, "contactPerson"),
    phone: field(formData, "phone"),
    whatsapp: field(formData, "whatsapp"),
    email: field(formData, "email"),
    address: field(formData, "address"),
    notes: field(formData, "notes"),
  };
}

export async function createPartyAction(
  kind: PartyKind,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const service = serviceFor(kind);
  const actor = await asEditor();
  let id = "";
  const state = await formAction(async () => {
    ({ id } = await service.create(actor, inputFrom(formData)));
  });
  if (state?.error) return state;
  redirect(`${PARTY[kind].path}/${id}`);
}

export async function updatePartyAction(
  kind: PartyKind,
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const service = serviceFor(kind);
  const actor = await asEditor();
  const state = await formAction(() =>
    service.update(actor, id, inputFrom(formData)),
  );
  if (state?.error) return state;
  redirect(`${PARTY[kind].path}/${id}`);
}

export async function setPartyActiveAction(
  kind: PartyKind,
  id: string,
  isActive: boolean,
): Promise<FormState> {
  const service = serviceFor(kind);
  const actor = await asEditor();
  const { label } = PARTY[kind];
  const state = await formAction(
    () => service.setActive(actor, id, isActive),
    isActive ? `${label} reactivated.` : `${label} deactivated.`,
  );
  refresh();
  return state;
}

export async function deletePartyAction(
  kind: PartyKind,
  id: string,
): Promise<FormState> {
  const service = serviceFor(kind);
  const actor = await requireRole(...PERMISSIONS.deleteMasterData);
  const state = await formAction(() => service.remove(actor, id));
  if (state?.error) return state;
  redirect(PARTY[kind].path);
}
