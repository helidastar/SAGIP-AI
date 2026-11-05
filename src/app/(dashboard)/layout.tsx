import { StaffProvider } from "@/components/dashboard/StaffProvider";
import { TestUiBanner } from "@/components/ui/basics";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TestUiBanner />
      <StaffProvider>{children}</StaffProvider>
    </>
  );
}
