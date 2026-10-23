import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// Thin brass lines at the logo's cut angle (~54°), 20% opacity, in one corner.
function BrassDiagonals({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      aria-hidden
      className={className}
      fill="none"
      stroke="var(--brass)"
      strokeOpacity={0.2}
      strokeWidth={1}
    >
      {[0, 28, 56, 84].map((dx) => (
        <line key={dx} x1={70 + dx} y1={240} x2={244 + dx} y2={0} />
      ))}
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <section className="relative flex h-[30dvh] min-h-48 flex-col items-center justify-center gap-4 overflow-hidden bg-navy pt-[env(safe-area-inset-top)] lg:h-auto lg:w-[45%]">
        <BrassDiagonals className="absolute right-0 bottom-0 size-40 lg:size-72" />
        <Image
          src="/brand/ze-logo-white.svg"
          alt="Zahir Enterprise"
          width={1350}
          height={560}
          priority
          className="h-auto w-56 lg:w-80"
        />
        <p className="section-label text-sidebar-text">
          Order &amp; Billing System
        </p>
      </section>

      <main className="flex flex-1 items-start justify-center px-4 py-10 lg:items-center lg:px-8">
        <div className="w-full max-w-[360px]">
          <h1 className="text-2xl font-semibold text-navy">Sign in</h1>
          <p className="mt-1 text-ink-muted">Use your ZE account.</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
