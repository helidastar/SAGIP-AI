"use client";

import { useCallback, useEffect, useState } from "react";
import { useStaff } from "@/components/dashboard/StaffProvider";
import {
  IncidentDossierView,
  type DossierIncidentDetail,
  type IncidentAction,
} from "@/components/dashboard/incident-dossier/IncidentDossier";
import { api } from "@/lib/api-client";

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "notFound" }
  | { status: "error"; message: string };

export function IncidentDetail({ id }: { id: string }) {
  const staff = useStaff();
  const [detail, setDetail] = useState<DossierIncidentDetail | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await api<DossierIncidentDetail>(`/api/incidents/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        setLoadState({ status: "notFound" });
      } else {
        setLoadState({
          status: "error",
          message: response.error ?? "Could not load incident details.",
        });
      }
      return;
    }

    setDetail(response.data);
    setLastRefreshed(new Date().toISOString());
    setLoadState({ status: "ready" });
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    void api<{ items: { id: string; name: string }[] }>("/api/teams").then((response) => {
      if (response.ok) setTeams(response.data.items);
      else setTeamsError(response.error ?? "Could not load teams.");
    });
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act({ label, path, method, json }: IncidentAction): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    const response = await api(path, { method, json });
    setBusy(false);
    if (!response.ok) {
      setError(`${label}: ${response.error}`);
      return false;
    }
    setError(null);
    setMessage(`${label}: done`);
    await load();
    return true;
  }

  function retry() {
    setLoadState({ status: "loading" });
    setError(null);
    void load();
  }

  if (loadState.status === "loading") {
    return (
      <IncidentDossierView
        state="loading"
        detail={null}
        staff={staff}
        teams={teams}
        teamsError={teamsError}
        lastRefreshed={lastRefreshed}
        busy={busy}
        error={error}
        message={message}
        onAction={act}
        onReviewDone={() => void load()}
        onRetry={retry}
        photoFailed={false}
        onPhotoError={() => setFailedPhotoId(id)}
      />
    );
  }

  if (loadState.status === "notFound") {
    return (
      <IncidentDossierView
        state="notFound"
        detail={null}
        staff={staff}
        teams={teams}
        teamsError={teamsError}
        lastRefreshed={lastRefreshed}
        busy={busy}
        error={error}
        message={message}
        onAction={act}
        onReviewDone={() => void load()}
        onRetry={retry}
        photoFailed={false}
        onPhotoError={() => setFailedPhotoId(id)}
      />
    );
  }

  if (loadState.status === "error") {
    return (
      <IncidentDossierView
        state="error"
        detail={null}
        stateMessage={loadState.message}
        staff={staff}
        teams={teams}
        teamsError={teamsError}
        lastRefreshed={lastRefreshed}
        busy={busy}
        error={error}
        message={message}
        onAction={act}
        onReviewDone={() => void load()}
        onRetry={retry}
        photoFailed={false}
        onPhotoError={() => setFailedPhotoId(id)}
      />
    );
  }

  if (!detail) {
    return (
      <IncidentDossierView
        state="loading"
        detail={null}
        staff={staff}
        teams={teams}
        teamsError={teamsError}
        lastRefreshed={lastRefreshed}
        busy={busy}
        error={error}
        message={message}
        onAction={act}
        onReviewDone={() => void load()}
        onRetry={retry}
        photoFailed={false}
        onPhotoError={() => setFailedPhotoId(id)}
      />
    );
  }

  return (
    <IncidentDossierView
      state="ready"
      detail={detail}
      staff={staff}
      teams={teams}
      teamsError={teamsError}
      lastRefreshed={lastRefreshed}
      busy={busy}
      error={error}
      message={message}
      onAction={act}
      onReviewDone={() => void load()}
      onRetry={retry}
      onRefresh={() => void load()}
      photoFailed={failedPhotoId === id}
      onPhotoError={() => setFailedPhotoId(id)}
    />
  );
}
