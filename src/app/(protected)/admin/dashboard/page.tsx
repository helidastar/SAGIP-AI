import { IncidentList } from "@/components/dashboard/IncidentList";
import { ReviewQueue } from "@/components/dashboard/ReviewQueue";

export default function AdminDashboardPage() {
  return (
    <>
      <IncidentList />
      <ReviewQueue compact />
    </>
  );
}