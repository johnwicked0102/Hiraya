export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-4 h-5 w-40 rounded-full" />
      <div className="skeleton mb-10 h-12 w-96 max-w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-[1.75rem]" />)}
      </div>
    </div>
  );
}
