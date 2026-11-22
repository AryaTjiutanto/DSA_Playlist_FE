export interface Song {
  id: number;
  judul: string;
  artis: string;
  durasi?: string;
}

export interface PlaylistResponse {
  playlist?: Song[];
  Songs?: Song[];
  songs?: Song[];
}

export type Source = "queue" | "playlist";

export interface NowPlaying {
  song: Song;
  source: Source;
}

export interface QueueItem {
  uid: number;
  song: Song;
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}