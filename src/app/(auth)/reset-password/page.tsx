import type { Metadata } from "next";
import { AuthScreen } from "../auth-screen";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

// Reached from the emailed link via /auth/confirm, which signs the User in.
export default function ResetPasswordPage() {
  return (
    <AuthScreen
      title="Set a new password"
      subtitle="Choose a password with at least 8 characters."
    >
      <ResetPasswordForm />
    </AuthScreen>
  );
}
