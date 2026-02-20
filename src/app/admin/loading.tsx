// ==========================================
// Admin Dashboard Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 bg-dark-700 rounded-lg" />
              <div className="h-3 w-16 bg-dark-700 rounded" />
            </div>
            <div className="h-8 w-20 bg-dark-700 rounded mb-1" />
            <div className="h-3 w-24 bg-dark-700 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 animate-pulse">
          <div className="h-6 w-36 bg-dark-700 rounded mb-4" />
          <div className="h-64 bg-dark-700/50 rounded-lg flex items-end gap-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-dark-600 rounded-t"
                style={{ height: `${30 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>

        {/* Orders chart */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 animate-pulse">
          <div className="h-6 w-32 bg-dark-700 rounded mb-4" />
          <div className="h-64 bg-dark-700/50 rounded-lg flex items-center justify-center">
            <div className="h-40 w-40 bg-dark-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Recent orders table skeleton */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 animate-pulse">
        <div className="h-6 w-36 bg-dark-700 rounded mb-4" />
        <div className="space-y-3">
          {/* Table header */}
          <div className="grid grid-cols-5 gap-4 pb-3 border-b border-dark-600">
            {['w-20', 'w-28', 'w-24', 'w-20', 'w-16'].map((w, i) => (
              <div key={i} className={`h-4 ${w} bg-dark-700 rounded`} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 py-2">
              <div className="h-4 w-24 bg-dark-700 rounded" />
              <div className="h-4 w-32 bg-dark-700 rounded" />
              <div className="h-4 w-20 bg-dark-700 rounded" />
              <div className="h-4 w-24 bg-dark-700 rounded" />
              <div className="h-6 w-20 bg-dark-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
