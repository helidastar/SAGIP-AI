import Link from "next/link";
import { ReportDetail } from "@/components/citizen/ReportDetail";
import { btnPrimary, Card } from "@/components/citizen/ui";

export default async function SubmittedPage({ searchParams }: PageProps<"/submitted">) {
  const { code } = await searchParams;
  const trackingCode = typeof code === "string" ? code : "";

  if (!trackingCode) {
    return (
      <Card className="py-10 text-center">
        <p className="text-sm text-cz-text-2">No tracking code found.</p>
        <Link href="/" className={`${btnPrimary} mt-4`}>Report an emergency</Link>
      </Card>
    );
  }
  return <ReportDetail code={trackingCode} justSubmitted />;
}
