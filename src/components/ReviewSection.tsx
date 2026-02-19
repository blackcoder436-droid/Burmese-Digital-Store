'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Check, ChevronDown, MessageSquare, ThumbsUp, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import type { IReview } from '@/types';

// ==========================================
// Product Reviews — Burmese Digital Store
// Displays review list + write review form
// ==========================================

interface ReviewSectionProps {
  productId: string;
  averageRating: number;
  reviewCount: number;
}

interface UserOrder {
  _id: string;
  orderNumber: string;
  createdAt: string;
}

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-gray-600'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-gray-400 text-right">{stars}★</span>
      <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-gray-500">{count}</span>
    </div>
  );
}

export default function ReviewSection({ productId, averageRating, reviewCount }: ReviewSectionProps) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [total, setTotal] = useState(reviewCount);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('newest');
  const [ratingDist, setRatingDist] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [loading, setLoading] = useState(false);
  const [avgRating, setAvgRating] = useState(averageRating);

  // Write review states
  const [showForm, setShowForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetchReviews = useCallback(async (p = 1, s = sort) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews?page=${p}&sort=${s}&limit=10`);
      const data = await res.json();
      if (data.success) {
        if (p === 1) {
          setReviews(data.data.reviews);
        } else {
          setReviews((prev) => [...prev, ...data.data.reviews]);
        }
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
        setRatingDist(data.data.ratingDistribution);
        setPage(p);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [productId, sort]);

  useEffect(() => {
    fetchReviews(1, sort);
  }, [sort, fetchReviews]);

  // Check auth + completed orders for this product
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
          setIsLoggedIn(true);
          // Fetch completed orders for this product
          const ordersRes = await fetch(`/api/orders?product=${productId}&status=completed`);
          const ordersData = await ordersRes.json();
          if (ordersData.success && ordersData.data?.orders) {
            setUserOrders(ordersData.data.orders);
          }
        }
      } catch {
        // not logged in
      }

      // Check if already reviewed
      try {
        const res = await fetch(`/api/products/${productId}/reviews?limit=1`);
        const data = await res.json();
        // We'll check in submit flow instead
      } catch {
        // silent
      }
    })();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newRating === 0 || newComment.trim().length < 5 || !selectedOrderId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: newRating,
          comment: newComment.trim(),
          orderId: selectedOrderId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setReviews((prev) => [data.data, ...prev]);
        setTotal((prev) => prev + 1);
        setNewRating(0);
        setNewComment('');
        setSelectedOrderId('');
        setShowForm(false);
        setHasReviewed(true);
        // Refresh to get updated aggregates
        fetchReviews(1, sort);
        // Update average
        const statsRes = await fetch(`/api/products/${productId}/reviews?limit=1`);
        const statsData = await statsRes.json();
        if (statsData.success) {
          setRatingDist(statsData.data.ratingDistribution);
          // Recalculate average from distribution
          const dist = statsData.data.ratingDistribution;
          const totalR = Object.values(dist).reduce((a: number, b) => a + (b as number), 0) as number;
          const sum = Object.entries(dist).reduce((a, [k, v]) => a + Number(k) * (v as number), 0);
          if (totalR > 0) setAvgRating(Math.round((sum / totalR) * 10) / 10);
        }
      } else {
        if (data.error?.includes('already reviewed')) {
          setHasReviewed(true);
        }
        alert(data.error || t('reviews.reviewFailed'));
      }
    } catch {
      alert(t('reviews.reviewFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          {t('reviews.title')}
        </h2>
        {isLoggedIn && userOrders.length > 0 && !hasReviewed && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            {t('reviews.writeReview')}
          </button>
        )}
      </div>

      {/* Rating Summary */}
      {total > 0 && (
        <div className="glass-panel p-5 mb-6 flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-4xl font-bold text-white">{avgRating.toFixed(1)}</span>
            <StarRating value={Math.round(avgRating)} readOnly size="md" />
            <span className="text-xs text-gray-500 mt-1">
              {t('reviews.basedOn')} {total} {t('reviews.reviewsCount')}
            </span>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => (
              <RatingBar key={stars} stars={stars} count={ratingDist[stars] || 0} total={total} />
            ))}
          </div>
        </div>
      )}

      {/* Write Review Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-5 mb-6 space-y-4">
          <h3 className="text-lg font-bold text-white">{t('reviews.writeReview')}</h3>

          {/* Order selector */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('reviews.selectOrder')}</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:border-purple-500 focus:outline-none"
              required
            >
              <option value="">{t('reviews.selectOrderHint')}</option>
              {userOrders.map((order) => (
                <option key={order._id} value={order._id}>
                  {order.orderNumber} — {new Date(order.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Star rating */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('reviews.rating')}</label>
            <StarRating value={newRating} onChange={setNewRating} size="lg" />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('reviews.comment')}</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('reviews.commentPlaceholder')}
              rows={4}
              maxLength={1000}
              className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:border-purple-500 focus:outline-none resize-none"
              required
              minLength={5}
            />
            <p className="text-xs text-gray-600 mt-1">{newComment.length}/1000</p>
          </div>

          <button
            type="submit"
            disabled={submitting || newRating === 0 || newComment.trim().length < 5 || !selectedOrderId}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('reviews.submitting') : t('reviews.submit')}
          </button>
        </form>
      )}

      {/* Sort options */}
      {total > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Sort:</span>
          {[
            { key: 'newest', label: t('reviews.sortNewest') },
            { key: 'highest', label: t('reviews.sortHighest') },
            { key: 'lowest', label: t('reviews.sortLowest') },
            { key: 'helpful', label: t('reviews.sortHelpful') },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sort === opt.key
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-dark-800 text-gray-500 border border-dark-600 hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 && !loading ? (
        <div className="glass-panel p-8 text-center">
          <MessageSquare className="w-10 h-10 text-dark-600 mx-auto mb-3" />
          <p className="text-gray-500">{t('reviews.noReviews')}</p>
          {!isLoggedIn && (
            <p className="text-sm text-gray-600 mt-2">{t('reviews.loginToReview')}</p>
          )}
          {isLoggedIn && userOrders.length === 0 && (
            <p className="text-sm text-gray-600 mt-2">{t('reviews.purchaseRequired')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review._id} className="glass-panel p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {review.user.avatar ? (
                    <img
                      src={review.user.avatar}
                      alt={review.user.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                      {review.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{review.user.name}</p>
                    <div className="flex items-center gap-2">
                      <StarRating value={review.rating} readOnly size="sm" />
                      {review.verified && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          {t('reviews.verified')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-600">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-300 leading-relaxed">{review.comment}</p>
              {review.helpful > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <ThumbsUp className="w-3 h-3" />
                  {review.helpful} {t('reviews.helpful')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Show More */}
      {page < totalPages && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchReviews(page + 1, sort)}
            disabled={loading}
            className="px-6 py-2 rounded-xl bg-dark-800 border border-dark-600 text-sm text-gray-400 hover:text-white hover:border-purple-500/50 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('reviews.showMore')}
          </button>
        </div>
      )}
    </div>
  );
}
