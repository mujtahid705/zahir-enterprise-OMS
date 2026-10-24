import type { Metadata } from "next";
import { AuthScreen } from "../auth-screen";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthScreen title="Sign in" subtitle="Use your ZE account.">
      <LoginForm />
    </AuthScreen>
  );
}
