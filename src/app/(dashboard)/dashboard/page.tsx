import { IncidentList } from "@/components/dashboard/IncidentList";
import { DashboardReviewQueuePanel } from "@/components/dashboard/DashboardReviewQueuePanel";
import styles from "@/components/dashboard/Dashboard.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.pageStack}>
      <IncidentList />
      <DashboardReviewQueuePanel />
    </div>
  );
}
