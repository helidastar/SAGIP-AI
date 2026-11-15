"use client";

import styles from "@/components/dashboard/Dashboard.module.css";

export function DashboardSkeleton() {
  return (
    <div className={styles.contentSkeleton} aria-label="Loading dashboard data" aria-busy="true">
      <div className={styles.listSkeleton} aria-hidden="true">
        <span className={`${styles.skeletonBar} ${styles.skeletonHeading}`} />
        {Array.from({ length: 5 }, (_, index) => (
          <div className={styles.skeletonRow} key={index}>
            <span className={styles.skeletonDot} />
            <span className={styles.skeletonCopy}>
              <span className={`${styles.skeletonBar} ${styles.skeletonWide}`} />
              <span className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.mapSkeletonPanel} aria-hidden="true">
        <span className={styles.skeletonMap} />
        <span className={styles.mapSkeletonText}>Synchronizing Barangay Spatial Mesh...</span>
      </div>
    </div>
  );
}

export function EmptyQueueState() {
  return (
    <section className={styles.stateCard} aria-labelledby="dashboard-empty-title">
      <span className={styles.stateIcon} aria-hidden="true"><CheckIcon /></span>
      <h2 id="dashboard-empty-title">All clear · No active incidents requiring action</h2>
      <p>There are currently no incident records in the open response queue.</p>
    </section>
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <section className={styles.stateCard} aria-labelledby="dashboard-no-results-title">
      <span className={`${styles.stateIcon} ${styles.stateIconNeutral}`} aria-hidden="true">
        <FilterIcon />
      </span>
      <h2 id="dashboard-no-results-title">No incidents match your current filters</h2>
      <p>Try clearing one or more filters to see matching incidents.</p>
      <button type="button" className={`${styles.primaryButton} ${styles.stateButton}`} onClick={onClear}>
        Clear filters
      </button>
    </section>
  );
}

export function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.requestError} role="alert" aria-labelledby="dashboard-error-title">
      <span className={styles.stateIcon} aria-hidden="true"><ErrorIcon /></span>
      <h2 id="dashboard-error-title">Unable to load incidents</h2>
      <p>{message}</p>
      <button type="button" className={styles.primaryButton} onClick={onRetry}>Retry</button>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 2.2 1.4 2.6.1 1.1 2.3 2.1 1.5-.5 2.6.7 2.5-1.8 1.9-.6 2.5-2.5.7-2 1.7-2.3-1.1-2.6.1-1.4-2.2-2.3-1.1-.1-2.6-1.4-2.2 1.4-2.2.1-2.6 2.3-1.1 1.4-2.2 2.6.1L12 3Z" />
      <path d="m8.6 12.1 2.2 2.2 4.7-4.8" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5h16M7 10h10m-7 5h4m-2 0v5" />
      <path d="m4 4 16 16" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3 22 21H2L12 3Z" />
      <path d="M12 9v5m0 3v.1" />
    </svg>
  );
}
