type PageLoadingSkeletonProps = {
  cards?: number;
  showTable?: boolean;
};

export function PageLoadingSkeleton({ cards = 3, showTable = true }: PageLoadingSkeletonProps) {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-6 py-2" role="status" aria-label="Loading page">
      <section className="h-40 rounded-[28px] border border-slate-100 bg-slate-100/80" />
      <div className="flex items-end justify-between gap-4"><div className="space-y-2"><div className="h-7 w-56 rounded bg-slate-200" /><div className="h-4 w-96 max-w-full rounded bg-slate-100" /></div><div className="h-10 w-32 rounded-xl bg-slate-100" /></div>
      <div className={`grid gap-4 ${cards === 1 ? "grid-cols-1" : cards === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{Array.from({ length: cards }).map((_, index) => <div key={index} className="h-36 rounded-2xl border border-slate-100 bg-white p-5"><div className="h-4 w-24 rounded bg-slate-100" /><div className="mt-5 h-8 w-16 rounded bg-slate-200" /><div className="mt-4 h-3 w-4/5 rounded bg-slate-100" /></div>)}</div>
      {showTable && <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white"><div className="h-14 border-b border-slate-100 bg-slate-50" />{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex gap-4 border-b border-slate-50 p-5 last:border-0"><div className="h-4 w-1/4 rounded bg-slate-100" /><div className="h-4 w-1/3 rounded bg-slate-100" /><div className="h-4 w-1/5 rounded bg-slate-100" /></div>)}</div>}
      <span className="sr-only">Loading workspace data…</span>
    </div>
  );
}
