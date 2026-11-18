import { Suspense } from "react";
import { ReviewQueuePage as ReviewQueueFeature } from "@/components/dashboard/review-queue/ReviewQueuePage";

export default function ReviewQueuePage() {
  return (
    <Suspense>
      <ReviewQueueFeature />
    </Suspense>
  );
}
