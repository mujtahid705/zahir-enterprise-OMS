import { RoleGate } from "@/components/role-gate";
import { TopBar } from "@/components/shell/top-bar";
import { ListSkeleton } from "@/components/skeletons";
import { PERMISSIONS } from "@/lib/permissions";

export default function Layout({ children }: LayoutProps<"/reports">) {
  return (
    <RoleGate
      roles={PERMISSIONS.viewReports}
      fallback={
        <>
          <TopBar title="Reports" />
          <main className="flex-1 p-4 md:p-8">
            <ListSkeleton />
          </main>
        </>
      }
    >
      {children}
    </RoleGate>
  );
}
