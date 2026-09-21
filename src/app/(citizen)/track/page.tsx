import { TrackReport } from "@/components/citizen/TrackReport";

export default async function TrackReportPage({ searchParams }: PageProps<"/track">) {
  const { code } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Track your report</h1>
      <TrackReport initialCode={typeof code === "string" ? code : ""} />
    </>
  );
}
