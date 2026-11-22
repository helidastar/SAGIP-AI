import type { Metadata } from "next";
import { StaffLogin } from "@/components/auth/StaffLogin";

export const metadata: Metadata = {
  title: "Staff sign in | SAGIP-AI",
};

export default function AdminLoginPage() {
  return <StaffLogin />;
}
