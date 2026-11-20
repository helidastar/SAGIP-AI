"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { saveReport } from "@/lib/citizen/saved-reports";
import { CameraIcon, PinIcon } from "./icons";
import { btnPrimary, btnSecondary, Card, inputCls, PageTitle } from "./ui";

// Leaflet needs the browser, so the map loads on the client only.
const PinMap = dynamic(() => import("./PinMap").then((m) => m.PinMap), { ssr: false });

/** True when both values are numbers inside the valid latitude/longitude range. */
function validLatLng(lat: string, lng: string) {
  const a = Number(lat);
  const b = Number(lng);
  return lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

/** Report form. Always starts blank: nothing is pre-filled, including the location. */
export function ReportForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the preview's object URL when it changes or the form closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(file: File | null) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function locate() {
    if (!navigator.geolocation) return setError("Location isn't available in this browser. Enter coordinates instead.");
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setManual(false);
        setLocating(false);
      },
      (err) => {
        setError(`Couldn't get your location (${err.message}). You can enter coordinates instead.`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const locationOk = coords !== null && coords.lat.trim() !== "" && coords.lng.trim() !== "";
  const canSubmit = locationOk && (description.trim() !== "" || photo !== null) && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    const form = new FormData();
    form.append("description", description);
    form.append("lat", coords.lat);
    form.append("lng", coords.lng);
    if (photo) form.append("photo", photo);

    const res = await api<{ trackingCode: string }>("/api/reports", { method: "POST", body: form });
    if (!res.ok) {
      setSubmitting(false);
      return setError(res.error);
    }
    saveReport({
      code: res.data.trackingCode,
      title: description.trim() ? description.trim().slice(0, 80) : "Emergency report (photo)",
      location: `${Number(coords.lat).toFixed(4)}, ${Number(coords.lng).toFixed(4)}`,
      createdAt: new Date().toISOString(),
    });
    router.push(`/submitted?code=${encodeURIComponent(res.data.trackingCode)}`);
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageTitle title="Report an emergency" subtitle="Add a photo, tell us what happened, and share where. No account needed." />

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">1. Add a photo</h2>
            {preview ? (
              <div className="relative overflow-hidden rounded border border-cz-border bg-cz-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={preview} alt="Selected emergency photo" className="max-h-72 w-full object-contain" />
                <button type="button" onClick={() => choosePhoto(null)} className="absolute right-2 top-2 rounded bg-cz-surface px-3 py-1.5 text-xs font-semibold shadow">
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-cz-border-strong text-cz-text-2 transition-colors hover:bg-cz-surface-2 focus-within:ring-2 focus-within:ring-cz-primary/40">
                <CameraIcon className="h-8 w-8" />
                <span className="text-sm font-semibold">Add photo</span>
                <span className="text-xs text-cz-text-3">Take a picture or choose one from your gallery</span>
                <input type="file" accept="image/*" onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)} className="sr-only" />
              </label>
            )}
          </Card>

          <Card>
            <label htmlFor="description" className="mb-3 block font-display text-base font-semibold">2. What is happening?</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Describe the emergency, e.g. flood water rising near the bridge"
              className={inputCls}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold">3. Where is it?</h2>
            {coords ? (
              <div className="flex items-center gap-3 rounded border border-cz-border bg-cz-surface-2 p-3">
                <PinIcon className="h-6 w-6 shrink-0 text-cz-link" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Location detected</p>
                  <p className="font-code text-xs text-cz-text-2">{coords.lat}, {coords.lng}</p>
                </div>
                <button type="button" onClick={locate} disabled={locating} className="text-sm font-semibold text-cz-link underline disabled:opacity-50">
                  {locating ? "Locating…" : "Update"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={locate} disabled={locating} className={`${btnSecondary} w-full`}>
                <PinIcon className="h-5 w-5" />
                {locating ? "Locating…" : "Locate me"}
              </button>
            )}

            {manual ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  aria-label="Latitude"
                  inputMode="decimal"
                  placeholder="Latitude"
                  value={coords?.lat ?? ""}
                  onChange={(e) => setCoords({ lat: e.target.value, lng: coords?.lng ?? "" })}
                  className={`${inputCls} font-code`}
                />
                <input
                  aria-label="Longitude"
                  inputMode="decimal"
                  placeholder="Longitude"
                  value={coords?.lng ?? ""}
                  onChange={(e) => setCoords({ lat: coords?.lat ?? "", lng: e.target.value })}
                  className={`${inputCls} font-code`}
                />
              </div>
            ) : (
              <button type="button" onClick={() => setManual(true)} className="mt-3 text-xs font-semibold text-cz-text-2 underline">
                Can&apos;t use GPS? Enter coordinates
              </button>
            )}

            {coords && validLatLng(coords.lat, coords.lng) && (
              <>
                <PinMap
                  lat={Number(coords.lat)}
                  lng={Number(coords.lng)}
                  onMove={(lat, lng) => setCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) })}
                />
                <p className="mt-1.5 text-xs text-cz-text-3">Not exactly right? Drag the pin or tap the map.</p>
              </>
            )}
          </Card>

          {error && (
            <p role="alert" className="rounded border border-cz-danger bg-cz-danger-soft px-3 py-2 text-sm font-semibold text-cz-danger">{error}</p>
          )}

          <button type="submit" disabled={!canSubmit} className={`${btnPrimary} w-full py-3.5 text-base`}>
            {submitting ? "Sending…" : "Submit report"}
          </button>
          <p className="text-center text-xs text-cz-text-3">
            {!locationOk ? "Share your location to submit. " : ""}Add a photo or a description.
          </p>
        </div>
      </div>
    </form>
  );
}
