import { BottomNav, Sidebar } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Sidebar />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 md:pb-10 md:pl-72">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
