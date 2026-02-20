// ==========================================
// Admin Orders Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

export default function AdminOrdersLoading() {
  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="h-8 w-40 bg-dark-700 rounded animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-dark-800 border border-dark-600 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="h-11 bg-dark-800 border border-dark-600 rounded-xl animate-pulse" />

      {/* Bulk action bar placeholder */}
      <div className="h-10 bg-dark-800/50 rounded-lg animate-pulse" />

      {/* Orders table */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden animate-pulse">
        {/* Table header */}
        <div className="grid grid-cols-7 gap-4 p-4 border-b border-dark-600">
          {['w-6', 'w-20', 'w-28', 'w-24', 'w-20', 'w-20', 'w-20'].map((w, i) => (
            <div key={i} className={`h-4 ${w} bg-dark-700 rounded`} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-4 p-4 border-b border-dark-700/50">
            <div className="h-4 w-4 bg-dark-700 rounded" />
            <div className="h-4 w-24 bg-dark-700 rounded" />
            <div className="h-4 w-32 bg-dark-700 rounded" />
            <div className="h-4 w-28 bg-dark-700 rounded" />
            <div className="h-6 w-20 bg-dark-700 rounded-full" />
            <div className="h-4 w-24 bg-dark-700 rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-dark-700 rounded" />
              <div className="h-8 w-8 bg-dark-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-10 bg-dark-800 border border-dark-600 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
