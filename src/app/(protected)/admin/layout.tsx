import type { ReactNode } from "react";
import { StaffProvider } from "@/components/dashboard/StaffProvider";
import { getStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");

  return (
    <StaffProvider initialStaff={staff} portal="admin">
      {children}
    </StaffProvider>
  );
}