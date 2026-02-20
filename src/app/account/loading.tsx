// ==========================================
// Account Page Loading Skeleton
// Phase 10.1 — Streaming/Suspense boundary
// ==========================================

export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-dark-950 pt-2 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile header skeleton */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 mb-6 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 bg-dark-700 rounded-full flex-shrink-0" />
            <div className="flex-1 text-center sm:text-left space-y-2">
              {/* Name */}
              <div className="h-7 w-48 bg-dark-700 rounded mx-auto sm:mx-0" />
              {/* Email */}
              <div className="h-4 w-56 bg-dark-700 rounded mx-auto sm:mx-0" />
              {/* Member since */}
              <div className="h-3 w-40 bg-dark-700 rounded mx-auto sm:mx-0" />
            </div>
            {/* Session badge */}
            <div className="h-8 w-32 bg-dark-700 rounded-full" />
          </div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-4 text-center animate-pulse">
              <div className="h-5 w-5 bg-dark-700 rounded mx-auto mb-2" />
              <div className="h-7 w-10 bg-dark-700 rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-dark-700 rounded mx-auto" />
            </div>
          ))}
        </div>

        {/* Quick links skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-4 animate-pulse">
              <div className="h-10 w-10 bg-dark-700 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-28 bg-dark-700 rounded" />
                <div className="h-3 w-40 bg-dark-700 rounded" />
              </div>
              <div className="h-4 w-4 bg-dark-700 rounded" />
            </div>
          ))}
        </div>

        {/* Recent orders skeleton */}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 animate-pulse">
          <div className="h-6 w-36 bg-dark-700 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-dark-900 rounded-lg">
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-dark-700 rounded" />
                  <div className="h-3 w-20 bg-dark-700 rounded" />
                </div>
                <div className="h-6 w-20 bg-dark-700 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
