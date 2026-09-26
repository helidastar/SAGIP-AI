"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, CameraIcon, ErrorText, Hint, inputClass, Panel, PinIcon } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

export function ReportForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Defaults sit inside "Sample Area A" from the seed data, so scoring has area data.
  const [lat, setLat] = useState("10.32");
  const [lng, setLng] = useState("123.88");
  const [located, setLocated] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the preview's object URL when it's replaced or the form unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(file: File | null) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Location isn't available in this browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocated(true);
        setLocating(false);
      },
      (err) => {
        setError(`Couldn't get location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData();
    form.append("description", description);
    form.append("lat", lat);
    form.append("lng", lng);
    if (photo) form.append("photo", photo);

    const res = await api<{ trackingCode: string }>("/api/reports", { method: "POST", body: form });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    router.push(`/submitted?code=${encodeURIComponent(res.data.trackingCode)}`);
  }

  return (
    <Panel title="Report incident" step="1/3" bodyClassName="p-3">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Hint>photo upload</Hint>
        {preview ? (
          <div className="relative border border-dashed border-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={preview} alt="Selected photo" className="max-h-64 w-full object-contain" />
            <button type="button" onClick={() => choosePhoto(null)} className="absolute right-2 top-2 border border-line bg-background px-2 py-1 font-mono text-[10px] uppercase">
              Remove
            </button>
          </div>
        ) : (
          <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-muted text-muted hover:bg-grid/50">
            <CameraIcon className="h-9 w-9" />
            <span className="font-mono text-[11px]">tap to take or choose a photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        )}

        <Hint className="mt-2">description field</Hint>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What happened? e.g. Sunog sa balay sa among silingan"
          className={inputClass}
        />

        <Hint className="mt-2">GPS location picker</Hint>
        <div className="flex flex-col gap-2 border border-line p-3">
          <div className="flex items-center justify-center gap-2 py-2">
            <PinIcon />
            <span className="font-mono text-xs">
              {lat}, {lng}
            </span>
          </div>
          <p className="text-center font-mono text-[10px] text-muted">
            {located ? "using your current location" : "sample location; tap “use my location”"}
          </p>
          {editingPin && (
            <div className="grid grid-cols-2 gap-2">
              <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" required aria-label="Latitude" className={inputClass} />
              <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" required aria-label="Longitude" className={inputClass} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={useMyLocation} disabled={locating} className="font-mono text-[11px] underline disabled:opacity-50">
              {locating ? "locating..." : "use my location"}
            </button>
            <button type="button" onClick={() => setEditingPin((v) => !v)} className="font-mono text-[11px] text-muted underline">
              {editingPin ? "done" : "edit pin"}
            </button>
          </div>
        </div>

        <ErrorText>{error}</ErrorText>
        <Hint className="mt-2">submit CTA</Hint>
        <Button type="submit" disabled={submitting || (!description.trim() && !photo)} className="py-3.5">
          {submitting ? "Sending..." : "Submit report"}
        </Button>
        <p className="text-center font-mono text-[10px] text-muted">Add a photo or a description. No account needed.</p>
      </form>
    </Panel>
  );
}
