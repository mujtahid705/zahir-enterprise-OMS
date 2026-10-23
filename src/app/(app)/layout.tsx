import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { PLACEHOLDER_USER } from "@/components/shell/placeholder-user";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const { role } = PLACEHOLDER_USER;
  return (
    <div className="flex min-h-dvh">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomTabBar role={role} />
    </div>
  );
}
