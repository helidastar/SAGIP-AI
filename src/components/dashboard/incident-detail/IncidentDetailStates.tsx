"use client";

import Link from "next/link";
import styles from "./IncidentDetail.module.css";

export function IncidentDetailSkeleton() {
  return (
    <div className={styles.pageSkeleton} aria-label="Loading incident details" aria-busy="true">
      <span className={styles.skeletonBar} aria-hidden="true" />
      <span className={`${styles.skeletonBar} ${styles.skeletonBarShort}`} aria-hidden="true" />
      <div className={styles.skeletonOverview} aria-hidden="true">
        <span className={styles.skeletonBlock} />
        <span className={styles.skeletonBlock} />
      </div>
      <span className={`${styles.skeletonBlock} ${styles.skeletonWorkflow}`} aria-hidden="true" />
      <div className={styles.skeletonOverview} aria-hidden="true">
        <span className={`${styles.skeletonBlock} ${styles.skeletonDecisions}`} />
        <span className={`${styles.skeletonBlock} ${styles.skeletonDecisions}`} />
      </div>
      <span className={`${styles.skeletonBlock} ${styles.skeletonWorkflow}`} aria-hidden="true" />
    </div>
  );
}

export function IncidentDetailError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={styles.pageError} role="alert" aria-labelledby="incident-detail-error-title">
      <span className={styles.pageErrorIcon} aria-hidden="true"><ErrorIcon /></span>
      <h1 id="incident-detail-error-title">{title}</h1>
      <p>{message}</p>
      <div className={styles.pageErrorActions}>
        <button type="button" className={styles.actionButton} onClick={onRetry}>Retry</button>
        <Link href="/dashboard" className={`${styles.actionButton} ${styles.actionButtonSecondary}`}>Back to Ranked List</Link>
      </div>
    </section>
  );
}

export function IncidentPhotoFallback({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.photoFallback} role="status">
      <PhotoIcon />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3v.1" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="1" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 5-4 3 2 2-2 4 4M3 3l18 18" />
    </svg>
  );
}
