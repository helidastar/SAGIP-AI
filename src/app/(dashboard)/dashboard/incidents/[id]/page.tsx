import { IncidentDetail } from "@/components/dashboard/IncidentDetail";

export default async function IncidentDetailPage({ params }: PageProps<"/dashboard/incidents/[id]">) {
  const { id } = await params;
  return <IncidentDetail id={id} />;
}
