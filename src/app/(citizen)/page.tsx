import { ReportForm } from "@/components/citizen/ReportForm";

export default function ReportIncidentPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Report an incident</h1>
      <p className="text-sm opacity-70">Add a photo or a short description, and your location. No account needed.</p>
      <ReportForm />
    </>
  );
}
