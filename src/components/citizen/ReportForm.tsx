"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field, inputClass } from "@/components/ui/basics";
import { api } from "@/lib/api-client";

export function ReportForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // Defaults sit inside "Sample Area A" from the seed data, so scoring has area data.
  const [lat, setLat] = useState("10.32");
  const [lng, setLng] = useState("123.88");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Location isn't available in this browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Photo (optional)">
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className={inputClass} />
      </Field>
      <Field label="What happened?">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. Sunog sa balay sa among silingan"
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" required className={inputClass} />
        </Field>
        <Field label="Longitude">
          <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" required className={inputClass} />
        </Field>
      </div>
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={locating}>
        {locating ? "Getting location..." : "Use my location"}
      </Button>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={submitting || (!description.trim() && !photo)}>
        {submitting ? "Sending..." : "Send report"}
      </Button>
    </form>
  );
}
