import { redirect } from "next/navigation";

// The staff dashboard lives at /dashboard; this older portal page only forwards there.
export default function AdminDashboardPage() {
  redirect("/dashboard");
}
