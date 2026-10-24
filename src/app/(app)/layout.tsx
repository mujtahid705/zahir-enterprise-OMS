import { Suspense } from "react";
import {
  BottomTabBar,
  BottomTabBarFallback,
} from "@/components/shell/bottom-tab-bar";
import { Sidebar, SidebarFallback } from "@/components/shell/sidebar";
import { getCurrentUser } from "@/lib/auth";

// The nav depends on the User's role and the pathname, so it streams in
// behind Suspense; its fallbacks and the rest of the shell prerender.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<SidebarFallback />}>
        <UserSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <Suspense fallback={<BottomTabBarFallback />}>
        <UserBottomTabBar />
      </Suspense>
    </div>
  );
}

async function UserSidebar() {
  const { role } = await getCurrentUser();
  return <Sidebar role={role} />;
}

async function UserBottomTabBar() {
  const { role } = await getCurrentUser();
  return <BottomTabBar role={role} />;
}
