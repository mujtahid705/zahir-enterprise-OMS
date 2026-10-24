"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Pencil } from "lucide-react";
import { deletePartyAction, setPartyActiveAction } from "@/actions/parties";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { PARTY, type PartyKind } from "@/lib/parties";

// Edit, deactivate/reactivate and (Admin) delete for one record. Shown only
// to roles that may use them; the actions check again.
export function PartyActions({
  kind,
  id,
  name,
  isActive,
  canDelete,
}: {
  kind: PartyKind;
  id: string;
  name: string;
  isActive: boolean;
  canDelete: boolean;
}) {
  const { label, path } = PARTY[kind];
  const [activeState, activeAction, activePending] = useActionState(
    setPartyActiveAction.bind(null, kind, id, !isActive),
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePartyAction.bind(null, kind, id),
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
          <Link href={`${path}/${id}/edit`}>
            <Pencil strokeWidth={1.5} />
            Edit {lower}
          </Link>
        </Button>
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
        {canDelete && (
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
