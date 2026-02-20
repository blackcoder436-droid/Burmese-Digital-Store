// ==========================================
// Product Detail Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-dark-950 pt-2 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <div className="h-5 w-28 bg-dark-800 rounded mb-6 animate-pulse" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product image skeleton */}
          <div className="w-full aspect-square bg-dark-800 border border-dark-600 rounded-2xl animate-pulse" />

          {/* Product info skeleton */}
          <div className="space-y-4">
            {/* Category badge */}
            <div className="h-6 w-20 bg-dark-700 rounded-full animate-pulse" />
            {/* Title */}
            <div className="h-8 w-3/4 bg-dark-700 rounded animate-pulse" />
            {/* Rating */}
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-5 w-5 bg-dark-700 rounded animate-pulse" />
              ))}
              <div className="h-5 w-16 bg-dark-700 rounded ml-2 animate-pulse" />
            </div>
            {/* Price */}
            <div className="h-10 w-36 bg-dark-700 rounded animate-pulse" />
            {/* Stock + Duration chips */}
            <div className="flex gap-2">
              <div className="h-7 w-24 bg-dark-700 rounded-full animate-pulse" />
              <div className="h-7 w-28 bg-dark-700 rounded-full animate-pulse" />
            </div>
            {/* Description lines */}
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-dark-800 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-dark-800 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-dark-800 rounded animate-pulse" />
            </div>
            {/* Quantity selector */}
            <div className="flex items-center gap-3 pt-4">
              <div className="h-10 w-10 bg-dark-800 rounded-lg animate-pulse" />
              <div className="h-10 w-12 bg-dark-800 rounded-lg animate-pulse" />
              <div className="h-10 w-10 bg-dark-800 rounded-lg animate-pulse" />
            </div>
            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <div className="h-12 flex-1 bg-dark-700 rounded-xl animate-pulse" />
              <div className="h-12 flex-1 bg-purple-900/30 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Review section skeleton */}
        <div className="mt-12 space-y-4">
          <div className="h-7 w-32 bg-dark-700 rounded animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-2 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-dark-700 rounded-full" />
                  <div className="h-4 w-24 bg-dark-700 rounded" />
                  <div className="h-3 w-16 bg-dark-700 rounded ml-auto" />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-4 w-4 bg-dark-700 rounded" />
                  ))}
                </div>
                <div className="h-3 w-full bg-dark-700 rounded" />
                <div className="h-3 w-2/3 bg-dark-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
