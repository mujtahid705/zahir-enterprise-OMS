import { RoleGate } from "@/components/role-gate";
import { PERMISSIONS } from "@/lib/permissions";

export default function Layout({ children }: LayoutProps<"/reports">) {
  return <RoleGate roles={PERMISSIONS.viewReports}>{children}</RoleGate>;
}
