import type { HTMLAttributes } from "react";
import type { MenuItem, Song } from "../types/song.type";
import { Cover, EqBars, Icon } from "./Pieces";
import { fmt, secondsOf } from "../helpers/index.helper";
import KebabMenu from "./KebabMenu";

interface SongRowProps {
  song: Song;
  index: number;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  menu: MenuItem[];
  menuLabel: string;
  extra?: HTMLAttributes<HTMLDivElement>;
  className?: string;
}

export default function SongRow({ song, index, active, playing, onPlay, menu, menuLabel, extra, className = "" }: SongRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPlay();
        }
      }}
      {...extra}
      className={`group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${
        active ? "bg-white/10" : ""
      } ${className}`}
    >
      <div className="flex w-6 shrink-0 items-center justify-center text-sm text-neutral-400">
        {active && playing ? (
          <EqBars />
        ) : (
          <>
            <span className={`group-hover:hidden ${active ? "text-red-500" : ""}`}>{index}</span>
            <Icon name="play" className="hidden h-4 w-4 text-white group-hover:block" />
          </>
        )}
      </div>
      <Cover id={song.id} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${active ? "text-red-500" : "text-white"}`}>{song.judul}</p>
        <p className="truncate text-xs text-neutral-400">{song.artis}</p>
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-400">{fmt(secondsOf(song))}</span>
      <div className="shrink-0 opacity-100 focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
        <KebabMenu items={menu} label={menuLabel} />
      </div>
    </div>
  );
}