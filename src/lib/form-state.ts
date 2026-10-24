import { forbidden } from "next/navigation";
import { NotAllowedError, UserInputError } from "@/lib/errors";

// What a form's Server Action hands back to useActionState.
export type FormState = { error?: string; message?: string } | undefined;

export function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

// Runs a service call for a form: input errors become the form's message, a
// role failure the forbidden page; anything else is a real error and throws.
export async function formAction(
  run: () => Promise<unknown>,
  message?: string,
): Promise<FormState> {
  try {
    await run();
    return message ? { message } : undefined;
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    if (error instanceof NotAllowedError) forbidden();
    throw error;
  }
}
