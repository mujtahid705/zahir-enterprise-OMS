"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Layout only. The sign-in Server Action is added in the auth ticket (SPEC §13.1).
export function LoginForm() {
  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <a
            href="#"
            className="text-sm text-ink-muted underline-offset-4 hover:text-navy hover:underline"
          >
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
