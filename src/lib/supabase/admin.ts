import "server-only";
import { createClient, StorageApiError } from "@supabase/supabase-js";
import { UserInputError } from "@/lib/errors";
import type { AssetStorage } from "@/services/company-settings";
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

const COMPANY_ASSETS = "company-assets";

// The private company-assets bucket (logo, signature). The browser never
// reaches it: images are served through the app.
export const supabaseCompanyAssets: AssetStorage = {
  async upload(path, bytes, contentType) {
    const { error } = await adminClient()
      .storage.from(COMPANY_ASSETS)
      .upload(path, bytes, { contentType });
    if (error) throw error;
  },

  async download(path) {
    const { data, error } = await adminClient()
      .storage.from(COMPANY_ASSETS)
      .download(path);
    // A row pointing at a missing file shows as no image, not an error.
    if (error instanceof StorageApiError && error.statusCode === "404") {
      return null;
    }
    if (error) throw error;
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type,
    };
  },

  async remove(path) {
    const { error } = await adminClient()
      .storage.from(COMPANY_ASSETS)
      .remove([path]);
    if (error) throw error;
  },
};
