import type { FormState } from "@/lib/form-state";

// Inline result under a form: an error, or a confirmation.
export function FormNotice({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="text-sm text-ink-muted">
        {state.message}
      </p>
    );
  }
  return null;
}
