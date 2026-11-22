export default function Panel({
    title,
    count,
    children,
    className = "",
}: {
    title: string;
    count: number;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`flex min-h-0 flex-col rounded-lg bg-black/50 ring-1 ring-white/5 ${className}`}>
            <header className="flex items-baseline justify-between px-4 pb-1 pt-3">
                <h2 className="text-base font-bold text-white">{title}</h2>
                <span className="text-xs text-neutral-400">{count} songs</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{children}</div>
        </section>
    );
}