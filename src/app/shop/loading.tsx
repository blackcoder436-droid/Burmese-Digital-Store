// ==========================================
// Shop Page Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

function SkeletonProductCard() {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden animate-pulse">
      {/* Image placeholder */}
      <div className="w-full h-48 bg-dark-700" />
      <div className="p-4 space-y-3">
        {/* Category badge */}
        <div className="h-5 w-16 bg-dark-700 rounded-full" />
        {/* Title */}
        <div className="h-5 w-3/4 bg-dark-700 rounded" />
        {/* Description */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-dark-700 rounded" />
          <div className="h-3 w-2/3 bg-dark-700 rounded" />
        </div>
        {/* Price + Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 w-24 bg-dark-700 rounded" />
          <div className="h-9 w-28 bg-dark-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-dark-950 pt-2 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="h-9 w-48 bg-dark-700 rounded mx-auto mb-3 animate-pulse" />
          <div className="h-4 w-72 bg-dark-800 rounded mx-auto animate-pulse" />
        </div>

        {/* Search bar skeleton */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="h-12 bg-dark-800 border border-dark-600 rounded-xl animate-pulse" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-dark-800 border border-dark-600 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex justify-center mt-8 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-10 bg-dark-800 border border-dark-600 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
