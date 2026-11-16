import type { IncidentType } from "@/types";

type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const ShieldIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /></svg>
);
export const CameraIcon = ({ className = "h-6 w-6" }: P) => (
  <svg {...base} className={className}><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const PinIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></svg>
);
export const CheckIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} strokeWidth={2.4} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const SearchIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
);
export const ArrowLeftIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const ChevronRightIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}><path d="M9 6l6 6-6 6" /></svg>
);
export const ClipboardIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></svg>
);
export const AlertIcon = ({ className = "h-5 w-5" }: P) => (
  <svg {...base} className={className}><path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5" /></svg>
);
export const CopyIcon = ({ className = "h-4 w-4" }: P) => (
  <svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
);

const WaterIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 9c2 0 2-1.5 4.5-1.5S10 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 14c2 0 2-1.5 4.5-1.5S10 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19" /></svg>
);
const TreeIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 3l6 8h-3l4 6H5l4-6H6l6-8zM12 17v4" /></svg>
);
const FireIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.5 1 2 2 2-.5-3 0-5 1-8z" /></svg>
);
const CarIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2h3v-2M17 16v2h3v-2M6 12h12" /></svg>
);
const MedicalIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
);

/** Icon for an incident type; a general alert when the type isn't known yet. */
export function TypeIcon({ type, className = "h-5 w-5" }: { type: IncidentType | null; className?: string }) {
  switch (type) {
    case "flood":
    case "landslide":
      return <WaterIcon className={className} />;
    case "fallen_debris":
      return <TreeIcon className={className} />;
    case "fire":
      return <FireIcon className={className} />;
    case "road_accident":
      return <CarIcon className={className} />;
    case "medical_emergency":
      return <MedicalIcon className={className} />;
    default:
      return <AlertIcon className={className} />;
  }
}
