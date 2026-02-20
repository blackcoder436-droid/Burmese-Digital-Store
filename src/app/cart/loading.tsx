// ==========================================
// Cart Page Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

function SkeletonCartItem() {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex gap-4 animate-pulse">
      {/* Product image */}
      <div className="w-20 h-20 bg-dark-700 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        {/* Name */}
        <div className="h-5 w-2/3 bg-dark-700 rounded" />
        {/* Category */}
        <div className="h-4 w-20 bg-dark-700 rounded" />
        {/* Price + quantity */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-dark-700 rounded" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-dark-700 rounded" />
            <div className="h-8 w-8 bg-dark-700 rounded" />
            <div className="h-8 w-8 bg-dark-700 rounded" />
          </div>
        </div>
      </div>
      {/* Remove button */}
      <div className="h-8 w-8 bg-dark-700 rounded flex-shrink-0" />
    </div>
  );
}

export default function CartLoading() {
  return (
    <div className="min-h-screen bg-dark-950 pt-2 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-8 w-8 bg-dark-700 rounded animate-pulse" />
          <div className="h-8 w-40 bg-dark-700 rounded animate-pulse" />
          <div className="h-6 w-12 bg-dark-700 rounded-full ml-2 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCartItem key={i} />
            ))}
          </div>

          {/* Order summary sidebar */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 h-fit space-y-4 animate-pulse">
            <div className="h-6 w-32 bg-dark-700 rounded" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-dark-700 rounded" />
                <div className="h-4 w-24 bg-dark-700 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-dark-700 rounded" />
                <div className="h-4 w-20 bg-dark-700 rounded" />
              </div>
            </div>
            {/* Coupon input */}
            <div className="h-10 w-full bg-dark-700 rounded-lg" />
            {/* Total */}
            <div className="border-t border-dark-600 pt-3 flex justify-between">
              <div className="h-6 w-12 bg-dark-700 rounded" />
              <div className="h-6 w-28 bg-dark-700 rounded" />
            </div>
            {/* Checkout button */}
            <div className="h-12 w-full bg-purple-900/30 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
