import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "../types/song.type";
import { Icon } from "./Pieces";

export default function KebabMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest("[data-kebab-menu]") && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return setPos(null);
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const height = items.length * 40 + 16;
    const top = rect.bottom + height > window.innerHeight ? rect.top - height - 4 : rect.bottom + 4;
    const left = Math.max(8, Math.min(rect.right - 192, window.innerWidth - 200));
    setPos({ top, left });
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        onClick={toggle}
        className="rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
      >
        <Icon name="dots" />
      </button>
      {pos && (
        <div
          role="menu"
          data-kebab-menu
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-40 w-48 rounded-md bg-neutral-800 p-1 shadow-2xl ring-1 ring-white/10"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setPos(null);
                item.onClick();
              }}
              className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                item.danger ? "text-red-400" : "text-neutral-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}