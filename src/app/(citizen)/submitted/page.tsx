import Link from "next/link";
import { TrackReport } from "@/components/citizen/TrackReport";
import { Card } from "@/components/ui/basics";

export default async function SubmittedPage({ searchParams }: PageProps<"/submitted">) {
  const { code } = await searchParams;
  const trackingCode = typeof code === "string" ? code : "";

  return (
    <>
      <h1 className="text-2xl font-bold">Report received</h1>
      {trackingCode ? (
        <>
          <Card>
            <p className="text-sm opacity-70">Save your tracking code:</p>
            <p className="font-mono text-3xl font-bold">{trackingCode}</p>
          </Card>
          <TrackReport initialCode={trackingCode} />
        </>
      ) : (
        <p>No tracking code found.</p>
      )}
      <Link href="/" className="text-sm underline">Send another report</Link>
    </>
  );
}
