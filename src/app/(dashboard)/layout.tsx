import { StaffProvider } from "@/components/dashboard/StaffProvider";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <StaffProvider>{children}</StaffProvider>;
}
