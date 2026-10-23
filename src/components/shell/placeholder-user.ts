import type { ShellUser } from "@/components/shell/user-menu";

// Stand-in until auth lands: replaced by getCurrentUser() from src/lib/auth.ts.
export const PLACEHOLDER_USER: ShellUser = {
  name: "Zahir Admin",
  role: "admin",
};
