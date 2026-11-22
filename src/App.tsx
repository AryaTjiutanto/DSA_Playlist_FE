import { useEffect, useRef, useState } from "react";
import { API_BASE } from "./const/api.const";
import type { MenuItem, NowPlaying, PlaylistResponse, QueueItem, Song } from "./types/song.type";
import SongRow from "./components/SongRow";
import { fmt, secondsOf } from "./helpers/index.helper";
import { Cover, Icon } from "./components/Pieces";
import Panel from "./components/Panel";

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${API_BASE}${path} failed (${res.status})`);
  }
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

const body = (data: unknown) => JSON.stringify(data);

const api = {
  getPlaylist: () => request("/playlist") as Promise<PlaylistResponse>,
  movePlaylist: (id: number, targetIndex: number) =>
    request(`/playlist/${id}`, { method: "PATCH", body: body({ id, target_index: targetIndex }) }),
  addPlaylist: (id: number) => request("/playlist/", { method: "POST", body: body({ id }) }),
  removePlaylist: (id: number) => request("/playlist/", { method: "DELETE", body: body({ id }) }),
  addPriority: (id: number) => request("/priority/", { method: "POST", body: body({ id }) }),
  next: () => request("/next", { method: "POST" }),
  prev: () => request("/prev", { method: "POST" }),
};

export default function App() {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [history, setHistory] = useState<NowPlaying[]>([]);
  const [cursor, setCursor] = useState(-1); 
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [modalSong, setModalSong] = useState<Song | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "error" | "info" } | null>(null);
  const [tab, setTab] = useState<"library" | "songs">("library");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const uid = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);


  const notify = (msg: string, kind: "error" | "info" = "info") => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const sync = (p: Promise<unknown>, rollback?: () => void) => {
    p.catch((e: unknown) => {
      rollback?.();
      notify(e instanceof Error ? e.message : "Request failed", "error");
    });
  };

  const load = async () => {
    setStatus("loading");
    try {
      const data = await api.getPlaylist();
      setPlaylist(data.playlist ?? []);
      setCatalog(data.Songs ?? data.songs ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /* ── playback clock ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!current || !playing) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [current, playing]);

  const nextRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (current && playing && elapsed >= secondsOf(current.song)) nextRef.current();
  }, [elapsed, current, playing]);

  /* ── playback actions ───────────────────────────────────────────────────── */
  const pushHistory = (np: NowPlaying) => setHistory((h) => [...h.slice(-49), np]);

  const startTrack = (np: NowPlaying) => {
    setCurrent(np);
    setElapsed(0);
    setPlaying(true);
  };

  const next = () => {
    sync(api.next());
    if (queue.length > 0) {
      const [first, ...rest] = queue;
      if (current) pushHistory(current);
      setQueue(rest);
      startTrack({ song: first.song, source: "queue" });
      return;
    }
    const idx = cursor + 1;
    if (idx < playlist.length) {
      if (current) pushHistory(current);
      setCursor(idx);
      startTrack({ song: playlist[idx], source: "playlist" });
      return;
    }
    setPlaying(false);
    setElapsed(0);
    notify("End of playlist");
  };
  nextRef.current = next;

  const prev = () => {
    sync(api.prev());
    const last = history[history.length - 1];
    if (!last) {
      setElapsed(0);
      if (current) setPlaying(true);
      return;
    }
    setHistory(history.slice(0, -1));
    if (current?.source === "queue") {
      setQueue((q) => [{ uid: ++uid.current, song: current.song }, ...q]);
    }
    if (last.source === "playlist") {
      const i = playlist.findIndex((s) => s.id === last.song.id);
      if (i >= 0) setCursor(i);
    } else if (current?.source === "playlist") {
      setCursor(cursor - 1);
    }
    startTrack(last);
  };

  const togglePlay = () => {
    if (!current) next();
    else setPlaying((p) => !p);
  };

  const playFromPlaylist = (i: number) => {
    const song = playlist[i];
    if (!song) return;
    if (current?.source === "playlist" && current.song.id === song.id) {
      setPlaying((p) => !p);
      return;
    }
    if (current) pushHistory(current);
    setCursor(i);
    startTrack({ song, source: "playlist" });
  };

  const playFromSongList = (song: Song) => {
    const i = playlist.findIndex((s) => s.id === song.id);
    if (i >= 0) playFromPlaylist(i);
    else setModalSong(song);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setElapsed(Math.floor(ratio * secondsOf(current.song)));
  };

  /* ── playlist / queue actions ───────────────────────────────────────────── */
  const addToPlaylist = (song: Song) => {
    if (playlist.some((s) => s.id === song.id)) return notify("Already in your playlist");
    const before = playlist;
    setPlaylist([...before, song]);
    sync(api.addPlaylist(song.id), () => setPlaylist(before));
    notify(`Added “${song.judul}” to your playlist`);
  };

  const playNext = (song: Song) => {
    const item: QueueItem = { uid: ++uid.current, song };
    setQueue((q) => [...q, item]);
    sync(api.addPriority(song.id), () => setQueue((q) => q.filter((x) => x.uid !== item.uid)));
    notify(`“${song.judul}” will play next`);
  };

  const removeFromPlaylist = (i: number) => {
    const song = playlist[i];
    if (!song) return;
    const beforeList = playlist;
    const beforeCursor = cursor;
    setPlaylist(playlist.filter((_, idx) => idx !== i));
    if (i <= cursor) setCursor(cursor - 1);
    sync(api.removePlaylist(song.id), () => {
      setPlaylist(beforeList);
      setCursor(beforeCursor);
    });
  };

  const movePlaylist = (from: number, to: number) => {
    if (from === to || to < 0 || to >= playlist.length) return;
    const beforeList = playlist;
    const beforeCursor = cursor;
    const list = [...playlist];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setPlaylist(list);

    let c = cursor;
    if (from === c) c = to;
    else if (from < c && to >= c) c -= 1;
    else if (from > c && to <= c) c += 1;
    setCursor(c);

    sync(api.movePlaylist(moved.id, to), () => {
      setPlaylist(beforeList);
      setCursor(beforeCursor);
    });
  };

  /* ── derived ────────────────────────────────────────────────────────────── */
  const duration = current ? secondsOf(current.song) : 0;
  const progress = duration ? Math.min(100, (elapsed / duration) * 100) : 0;
  const upNext = queue[0]?.song ?? playlist[cursor + 1];
  const sourceLabel = current?.source === "queue" ? "Queue" : "your playlist";

  const clearDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-black font-sans text-neutral-200">
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col gap-6 rounded-lg bg-neutral-950 p-5 lg:flex">
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600">
              <Icon name="note" className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">TPLDugem</span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Playlist anda</dt>
              <dd className="font-semibold text-white">{playlist.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Dalam antrian</dt>
              <dd className="font-semibold text-white">{queue.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Semua lagu</dt>
              <dd className="font-semibold text-white">{catalog.length}</dd>
            </div>
          </dl>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-gradient-to-b from-red-950/70 via-neutral-950 to-neutral-950">
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              <span className="lg:hidden">TPLDugem</span>
              <span className="hidden lg:inline">Perpustakaan Anda</span>
            </h1>
            <div className="flex rounded-full bg-black/60 p-1 text-sm lg:hidden" role="tablist">
              {(["library", "songs"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 font-medium ${
                    tab === t ? "bg-red-600 text-white" : "text-neutral-300"
                  }`}
                >
                  {t === "library" ? "Library" : "Songs"}
                </button>
              ))}
            </div>
          </div>

          {status !== "ready" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              {status === "loading" ? (
                <p className="text-neutral-400">Memuat musik anda…</p>
              ) : (
                <>
                  <p className="text-white">Tidak dapat memuat GET {API_BASE}/playlist.</p>
                  <button
                    onClick={() => void load()}
                    className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
                  >
                    Coba lagi
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              <div className={`min-h-0 flex-col gap-4 lg:flex ${tab === "library" ? "flex" : "hidden"}`}>
                <Panel title="Queue" count={queue.length} className="max-h-48 shrink-0">
                  {queue.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-neutral-500">
                      Tidak ada antrean. Pilih “Putar berikutnya” pada lagu mana pun untuk menempatkannya sebelum daftar putar Anda. 
                    </p>
                  ) : (
                    queue.map((item, i) => (
                      <div key={item.uid} className="flex items-center gap-3 rounded-md px-2 py-2">
                        <span className="w-6 shrink-0 text-center text-sm text-neutral-500">{i + 1}</span>
                        <Cover id={item.song.id} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{item.song.judul}</p>
                          <p className="truncate text-xs text-neutral-400">{item.song.artis}</p>
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-neutral-400">
                          {fmt(secondsOf(item.song))}
                        </span>
                      </div>
                    ))
                  )}
                </Panel>

                <Panel title="Your playlist" count={playlist.length} className="flex-1">
                  {playlist.length === 0 && (
                    <p className="px-2 py-3 text-sm text-neutral-500">
                      Playlist anda kosong. Tambahkan lagu dari list lagu
                    </p>
                  )}
                  {playlist.map((song, i) => {
                    const active = current?.source === "playlist" && current.song.id === song.id;
                    const dropping = dragOver === i && dragFrom !== null && dragFrom !== i;
                    return (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={i + 1}
                        active={active}
                        playing={playing}
                        onPlay={() => playFromPlaylist(i)}
                        menuLabel={`Options for ${song.judul}`}
                        className={`${dragFrom === i ? "opacity-40" : ""} ${dropping ? "ring-2 ring-red-500/70" : ""}`}
                        extra={{
                          draggable: true,
                          onDragStart: (e) => {
                            setDragFrom(i);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", String(i));
                          },
                          onDragOver: (e) => {
                            e.preventDefault();
                            setDragOver(i);
                          },
                          onDrop: (e) => {
                            e.preventDefault();
                            if (dragFrom !== null) movePlaylist(dragFrom, i);
                            clearDrag();
                          },
                          onDragEnd: clearDrag,
                        }}
                        menu={[
                          { label: "Play", onClick: () => playFromPlaylist(i) },
                          { label: "Play next", onClick: () => playNext(song) },
                          { label: "Move up", onClick: () => movePlaylist(i, i - 1), disabled: i === 0 },
                          {
                            label: "Move down",
                            onClick: () => movePlaylist(i, i + 1),
                            disabled: i === playlist.length - 1,
                          },
                          { label: "Hapus dari playlist", onClick: () => removeFromPlaylist(i), danger: true },
                        ]}
                      />
                    );
                  })}
                </Panel>
              </div>

              {/* Right: all songs */}
              <div className={`min-h-0 flex-col lg:flex ${tab === "songs" ? "flex" : "hidden"}`}>
                <Panel title="Songs" count={catalog.length} className="flex-1">
                  {catalog.map((song, i) => {
                    const inPlaylist = playlist.some((s) => s.id === song.id);
                    return (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={i + 1}
                        active={current?.song.id === song.id}
                        playing={playing}
                        onPlay={() => playFromSongList(song)}
                        menuLabel={`Options for ${song.judul}`}
                        menu={[
                          {
                            label: inPlaylist ? "Sudah ada di playlist" : "Tambahkan ke playlist",
                            onClick: () => addToPlaylist(song),
                            disabled: inPlaylist,
                          },
                          { label: "Putar setelah ini", onClick: () => playNext(song) },
                        ]}
                      />
                    );
                  })}
                </Panel>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Now playing bar */}
      <footer className="border-t border-white/5 bg-black px-3 pb-3 pt-2 md:px-4">
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_1.6fr_1fr] md:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {current ? (
              <>
                <Cover id={current.song.id} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{current.song.judul}</p>
                  <p className="truncate text-xs text-neutral-400">{current.song.artis}</p>
                  <p className="mt-0.5 text-xs font-medium text-red-500">Diputar dari {sourceLabel}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-500">
                Tidak ada yang diputar. Tekan putar untuk memulai antrean atau daftar putar Anda.
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4">
              <button
                aria-label="Previous"
                onClick={prev}
                className="rounded-full p-2 text-neutral-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
              >
                <Icon name="prev" className="h-6 w-6" />
              </button>
              <button
                aria-label={playing ? "Pause" : "Play"}
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:scale-105 hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
              >
                <Icon name={playing ? "pause" : "play"} className="h-6 w-6" />
              </button>
              <button
                aria-label="Next"
                onClick={next}
                className="rounded-full p-2 text-neutral-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
              >
                <Icon name="next" className="h-6 w-6" />
              </button>
            </div>
            <div className="flex w-full max-w-xl items-center gap-2 text-xs tabular-nums text-neutral-400">
              <span className="w-9 text-right">{fmt(Math.min(elapsed, duration))}</span>
              <div onClick={seek} className="group flex h-4 flex-1 cursor-pointer items-center" aria-hidden="true">
                <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-700">
                  <div className="h-full bg-red-600 group-hover:bg-red-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="w-9">{fmt(duration)}</span>
            </div>
          </div>

          <div className="hidden min-w-0 justify-end md:flex">
            {upNext && (
              <p className="truncate text-xs text-neutral-400">
                Selanjutnya: <span className="text-neutral-200">{upNext.judul}</span> · {upNext.artis}
              </p>
            )}
          </div>
        </div>
      </footer>

      {modalSong && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalSong(null)}
          onKeyDown={(e) => e.key === "Escape" && setModalSong(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-neutral-900 p-6 shadow-2xl ring-1 ring-white/10"
          >
            <div className="mb-4 flex items-center gap-3">
              <Cover id={modalSong.id} className="h-14 w-14" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{modalSong.judul}</p>
                <p className="truncate text-sm text-neutral-400">{modalSong.artis}</p>
              </div>
            </div>
            <h2 id="modal-title" className="text-lg font-bold text-white">
              Tidak dapat memutar lagu.
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Anda hanya dapat memutar lagu dari playlist atau antrian.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                autoFocus
                onClick={() => {
                  addToPlaylist(modalSong);
                  setModalSong(null);
                }}
                className="rounded-full bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Tambahkan ke playlist
              </button>
              <button
                onClick={() => {
                  playNext(modalSong);
                  setModalSong(null);
                }}
                className="rounded-full bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                Putar setelah ini
              </button>
              <button
                onClick={() => setModalSong(null)}
                className="py-2 text-sm font-medium text-neutral-400 hover:text-white"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-28 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow-lg md:bottom-24 ${
            toast.kind === "error" ? "bg-red-700" : "bg-neutral-800 ring-1 ring-white/10"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
