import { RoleGate } from "@/components/role-gate";
import { TopBar } from "@/components/shell/top-bar";
import { ListSkeleton } from "@/components/skeletons";
import { PERMISSIONS } from "@/lib/permissions";
import { SettingsTabs } from "./settings-tabs";

// Admin only (SPEC §9): Users and Company.
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <RoleGate
      roles={PERMISSIONS.manageUsers}
      fallback={
        <>
          <TopBar title="Settings" />
          <main className="flex-1 p-4 md:p-8">
            <ListSkeleton />
          </main>
        </>
      }
    >
      <TopBar title="Settings" />
      <main className="flex-1 p-4 md:p-8">
        <SettingsTabs />
        {children}
      </main>
    </RoleGate>
  );
}
