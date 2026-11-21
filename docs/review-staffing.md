# Review queue staffing plan (Others 16)

Every report goes to a person first (review-first, DOCUMENTATION.md 6.5), so the review queue is the main staff workload.

## Roles

| Role | Who (demo) | What they do |
|---|---|---|
| Reviewer (responder account) | 1 person per shift | Opens the review queue, confirms or corrects the AI draft, starting with "Check first" reports |
| Supervisor (admin account) | 1 person per shift | Assigns teams, overrides priority with a reason, handles possible-hoax reports |

## Rules

- Check-first reports (low confidence, high or critical severity, possible hoax, keyword fallback) are reviewed before the rest.
- A possible hoax is never rejected without a person looking at it.
- Shift handover: the outgoing reviewer clears or notes every check-first report.

## How many reviewers

Not measured yet. The pilot test with test users (Others 1) measures the time from opening a report to confirming it.
Estimate until then: about 1 minute per report, so one reviewer handles about 60 reports an hour.
Add a second reviewer when the queue holds more than 10 check-first reports for over 15 minutes. This is an estimate, to be replaced by the pilot result.
