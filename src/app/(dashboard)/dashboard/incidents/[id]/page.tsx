import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export default async function IncidentDetailPage({
  params,
}: PageProps<"/dashboard/incidents/[id]">) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Incident ${id}`}
      description="Photo, AI classification, priority score breakdown, audit history, and assignment controls."
    />
  );
}
