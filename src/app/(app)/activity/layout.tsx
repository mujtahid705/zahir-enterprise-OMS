import { RoleGate } from "@/components/role-gate";
import { PERMISSIONS } from "@/lib/permissions";

export default function Layout({ children }: LayoutProps<"/activity">) {
  return <RoleGate roles={PERMISSIONS.viewActivityLog}>{children}</RoleGate>;
}
