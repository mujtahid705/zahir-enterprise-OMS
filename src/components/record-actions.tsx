"use client";

import Link from "next/link";
import { useActionState, useId, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";

// Edit, deactivate/reactivate and (Admin) delete for one master data record
// (SPEC §4.4). The page binds the Server Actions to the record and shows this
// only to roles that may use them; the actions check again.
export function RecordActions({
  label,
  name,
  editHref,
  isActive,
  setActive,
  remove,
  children,
}: {
  label: string;
  name: string;
  editHref: string;
  isActive: boolean;
  // Flips the active flag.
  setActive: () => Promise<FormState>;
  // Only for roles that may delete.
  remove?: () => Promise<FormState>;
  // More buttons after Edit.
  children?: ReactNode;
}) {
  const [activeState, activeAction, activePending] = useActionState(
    setActive,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    remove ?? (async () => undefined),
    undefined,
  );
  const lower = label.toLowerCase();
  // Unique per mount: Next keeps the previous page mounted (hidden), and
  // ConfirmDialog finds its form by id.
  const activeFormId = useId();
  const deleteFormId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={editHref}>
            <Pencil strokeWidth={1.5} />
            Edit {lower}
          </Link>
        </Button>
        {children}
        <form id={activeFormId} action={activeAction}>
          {isActive ? (
            <ConfirmDialog
              formId={activeFormId}
              destructive
              title={`Deactivate ${name}?`}
              description={`It won't be offered when picking a ${lower}, but stays on past Orders. You can reactivate it later.`}
              confirmLabel="Deactivate"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={activePending}
                >
                  Deactivate
                </Button>
              }
            />
          ) : (
            <Button type="submit" variant="outline" disabled={activePending}>
              Reactivate
            </Button>
          )}
        </form>
        {remove && (
          <form id={deleteFormId} action={deleteAction}>
            <ConfirmDialog
              formId={deleteFormId}
              destructive
              title={`Delete ${name}?`}
              description={`This removes the ${lower} for good. A ${lower} used in an Order can't be deleted; deactivate it instead.`}
              confirmLabel="Delete"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletePending}
                >
                  Delete
                </Button>
              }
            />
          </form>
        )}
      </div>
      <FormNotice state={deleteState ?? activeState} />
    </div>
  );
}
