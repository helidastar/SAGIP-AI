import { ReviewQueue } from "@/components/dashboard/ReviewQueue";

export default function ReviewQueuePage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="text-sm opacity-70">Reports with low AI confidence, high/critical severity, or no AI check.</p>
      <ReviewQueue />
    </>
  );
}
