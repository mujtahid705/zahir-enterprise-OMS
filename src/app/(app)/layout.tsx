import { Suspense } from "react";
import { BottomTabBar, MoreItems } from "@/components/shell/bottom-tab-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { getCurrentUser } from "@/lib/auth";

// Role-dependent nav streams in behind Suspense and the rest of the shell
// prerenders. The sidebar fallback shows Staff's items, which every role sees.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<Sidebar role="staff" />}>
        <UserSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomTabBar
        moreItems={
          <Suspense fallback={<MoreItems role="staff" />}>
            <UserMoreItems />
          </Suspense>
        }
      />
    </div>
  );
}

async function UserSidebar() {
  const { role } = await getCurrentUser();
  return <Sidebar role={role} />;
}

async function UserMoreItems() {
  const { role } = await getCurrentUser();
  return <MoreItems role={role} />;
}
