import { redirect } from "next/navigation";

/** The old operations wireframe page; staff now work in the designed dashboard at /dashboard. */
export default function AdminDashboardPage() {
  redirect("/dashboard");
}
