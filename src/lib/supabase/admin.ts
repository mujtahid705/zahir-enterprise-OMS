import "server-only";
import { createClient } from "@supabase/supabase-js";
import { UserInputError } from "@/lib/errors";
import type { AuthAdmin } from "@/services/users";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// Supabase Admin API with the secret key: server only, never the browser
// (SPEC §13.1).
function adminClient() {
  return createClient(url(), process.env.SUPABASE_SECRET_KEY!, noSession);
}

export const supabaseAuthAdmin: AuthAdmin = {
  async createUser({ email, password }) {
    const { data, error } = await adminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error?.code === "email_exists") {
      throw new UserInputError("A User with that email already exists.");
    }
    if (error) throw error;
    return { id: data.user.id };
  },

  async deleteUser(id) {
    const { error } = await adminClient().auth.admin.deleteUser(id);
    if (error) throw error;
  },

  async setPassword(id, password) {
    const { error } = await adminClient().auth.admin.updateUserById(id, {
      password,
    });
    if (error?.code === "weak_password") {
      throw new UserInputError("That password is too weak.");
    }
    if (error) throw error;
  },

  // Signs in on a throwaway client (no cookies) and ends that session at once.
  async verifyPassword(email, password) {
    const client = createClient(
      url(),
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      noSession,
    );
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return false;
    await client.auth.signOut({ scope: "local" });
    return true;
  },
};
