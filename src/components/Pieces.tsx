import { COVERS } from "../const/color.const";

const PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  next: "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z",
  prev: "M6 6h2v12H6zM9.5 12l8.5 6V6z",
  dots: "M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z",
  note: "M12 3v10.55A4 4 0 1014 17V7h4V3h-6z",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Cover({ id, className = "h-10 w-10" }: { id: number; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded bg-gradient-to-br text-white/70 ${
        COVERS[Math.abs(id) % COVERS.length]
      } ${className}`}
    >
      <Icon name="note" className="h-1/2 w-1/2" />
    </div>
  );
}

export function EqBars() {
  return (
    <span className="flex h-4 items-end justify-center gap-0.5" aria-label="Playing">
      <span className="h-2 w-0.5 animate-pulse bg-red-500" />
      <span className="h-4 w-0.5 animate-pulse bg-red-500 [animation-delay:150ms]" />
      <span className="h-3 w-0.5 animate-pulse bg-red-500 [animation-delay:300ms]" />
    </span>
  );
}