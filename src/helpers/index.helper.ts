import type { Song } from "../types/song.type";

export const secondsOf = (song: Song): number => {
  const raw = String(song.durasi ?? "").trim();
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.some((n) => Number.isNaN(n))) return 180;
    return parts.reduce((acc, n) => acc * 60 + n, 0) || 180;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 180;
};

export const fmt = (total: number): string => {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};