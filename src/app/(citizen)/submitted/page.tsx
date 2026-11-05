import Link from "next/link";
import { CopyCode } from "@/components/citizen/CopyCode";
import { CheckIcon, Hint, Panel } from "@/components/ui/basics";

export default async function SubmittedPage({ searchParams }: PageProps<"/submitted">) {
  const { code } = await searchParams;
  const trackingCode = typeof code === "string" ? code : "";

  return (
    <Panel title="Confirmation" step="2/3" bodyClassName="flex flex-col items-center gap-3 p-4">
      {trackingCode ? (
        <>
          <span className="mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full border border-line">
            <CheckIcon className="h-6 w-6" />
          </span>
          <Hint>success state</Hint>
          <p className="text-center text-lg font-bold">Report received</p>
          <Hint className="mt-2">tracking code</Hint>
          <CopyCode code={trackingCode} />
          <p className="text-center text-sm text-muted">Responders will review your report. Use this code to check its status.</p>
          <p className="w-full border border-faint px-3 py-2 font-mono text-[11px] text-muted">
            Save this ID. There is no account; this is how you track your report.
          </p>
          <Link
            href={`/track?code=${encodeURIComponent(trackingCode)}`}
            className="w-full border border-line py-3 text-center font-mono text-xs font-bold uppercase tracking-wider hover:bg-grid"
          >
            Track this report
          </Link>
        </>
      ) : (
        <p className="py-6 text-sm text-muted">No tracking code found.</p>
      )}
      <Link href="/" className="font-mono text-[11px] text-muted underline">send another report</Link>
    </Panel>
  );
}
