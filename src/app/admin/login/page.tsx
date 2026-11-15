import type { Metadata } from "next";
import { OperationsLogin } from "@/components/auth/OperationsLogin";

export const metadata: Metadata = {
  title: "Operations Portal | SAGIP-AI",
};

export default function AdminLoginPage() {
  return <OperationsLogin />;
}