import { requireEnv, seedUsers } from "./seed-users.mts";

// Seeds the first Admin, who then creates everyone else in the app.
// Usage (see README):
//   SEED_ADMIN_EMAIL=… SEED_ADMIN_NAME=… SEED_ADMIN_PASSWORD=… pnpm db:seed-admin
// Does nothing if a profile with that email already exists.
await seedUsers(
  [
    {
      email: requireEnv("SEED_ADMIN_EMAIL"),
      fullName: requireEnv("SEED_ADMIN_NAME"),
      password: requireEnv("SEED_ADMIN_PASSWORD"),
      role: "admin",
    },
  ],
  { onExisting: "skip" },
);
console.log(`Admin ${process.env.SEED_ADMIN_EMAIL} is ready.`);
