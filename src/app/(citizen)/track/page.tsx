import { TrackReport } from "@/components/citizen/TrackReport";

export default async function TrackReportPage({ searchParams }: PageProps<"/track">) {
  const { code } = await searchParams;
  return <TrackReport initialCode={typeof code === "string" ? code : ""} />;
}
