import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
