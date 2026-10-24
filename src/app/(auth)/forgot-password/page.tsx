import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "../auth-screen";
import { ExpiredLinkNotice, ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      title="Forgot password"
      subtitle="We'll email you a link to set a new one."
    >
      <Suspense>
        <ExpiredLinkNotice />
      </Suspense>
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
