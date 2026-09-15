import { IncidentList } from "@/components/dashboard/IncidentList";

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Incidents</h1>
      <IncidentList />
    </>
  );
}
