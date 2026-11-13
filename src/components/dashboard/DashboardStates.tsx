export function DashboardSkeleton() {
  return (
    <section
      className="dashboard-content-skeleton"
      aria-label="Loading incident dashboard"
      aria-busy="true"
    >
      <div className="dashboard-list-skeleton" aria-hidden="true">
        <div className="dashboard-skeleton-bar dashboard-skeleton-title" />
        {Array.from({ length: 5 }, (_, index) => (
          <div className="dashboard-skeleton-row" key={index}>
            <span className="dashboard-skeleton-circle" />
            <span className="dashboard-skeleton-copy">
              <span className="dashboard-skeleton-bar" />
              <span className="dashboard-skeleton-bar dashboard-skeleton-short" />
            </span>
          </div>
        ))}
      </div>
      <div className="dashboard-map-skeleton" aria-hidden="true">
        <div className="dashboard-map-skeleton-surface" />
        <span>Synchronizing Barangay Spatial Mesh...</span>
      </div>
    </section>
  );
}

export function EmptyQueueState() {
  return (
    <section className="dashboard-state-card" aria-labelledby="empty-queue-title">
      <span className="dashboard-state-icon dashboard-state-icon-success" aria-hidden="true">
        <CheckSealIcon />
      </span>
      <h2 id="empty-queue-title">All clear · No active incidents requiring action</h2>
      <p>
        There are currently no incident records in the open response queue.
      </p>
      <span className="dashboard-monitoring-pill">
        <span className="dashboard-live-dot" aria-hidden="true" />
        Queue status: clear
      </span>
    </section>
  );
}

export function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <section className="dashboard-state-card" aria-labelledby="no-results-title">
      <span className="dashboard-state-icon dashboard-state-icon-neutral" aria-hidden="true">
        <FilterOffIcon />
      </span>
      <h2 id="no-results-title">No incidents match your current filter parameters</h2>
      <p>
        No emergency incidents match the current combination of priority, type,
        workflow, and search filters.
      </p>
      <button type="button" className="dashboard-primary-button" onClick={onClear}>
        Reset Active Filters
      </button>
    </section>
  );
}

function CheckSealIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 2.2 1.4 2.6.1 1.1 2.3 2.1 1.5-.5 2.6.7 2.5-1.8 1.9-.6 2.5-2.5.7-2 1.7-2.3-1.1-2.6.1-1.4-2.2-2.3-1.1-.1-2.6-1.4-2.2 1.4-2.2.1-2.6 2.3-1.1 1.4-2.2 2.6.1L12 3Z" />
      <path d="m8.6 12.1 2.2 2.2 4.7-4.8" />
    </svg>
  );
}

function FilterOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5h16M7 10h10m-7 5h4m-2 0v5" />
      <path d="m4 4 16 16" />
    </svg>
  );
}
