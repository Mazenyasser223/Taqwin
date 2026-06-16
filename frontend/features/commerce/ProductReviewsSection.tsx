import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceOptimizationService, {
  type ProductReview,
} from '../../services/marketplaceOptimizationService';
import { ProductRating } from './ProductRating';

interface ProductReviewsSectionProps {
  productId: string;
  avgRating?: number | null;
  reviewCount?: number | null;
  onReviewSubmitted?: () => void;
}

export function ProductReviewsSection({
  productId,
  avgRating,
  reviewCount,
  onReviewSubmitted,
}: ProductReviewsSectionProps) {
  const { t, language } = useI18n();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<{ canReview: boolean; reason?: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const res = await marketplaceOptimizationService.getReviews(productId);
    setLoading(false);
    if (res.data) setReviews(res.data.items);
  }, [productId]);

  useEffect(() => {
    void loadReviews();
    void marketplaceOptimizationService.getReviewEligibility(productId).then((res) => {
      if (res.data) setEligibility(res.data);
    });
  }, [productId, loadReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await marketplaceOptimizationService.submitReview(productId, {
      rating,
      title: title.trim() || undefined,
      body: body.trim(),
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setBody('');
    setTitle('');
    setEligibility({ canReview: false, reason: 'already_reviewed' });
    void loadReviews();
    onReviewSubmitted?.();
  };

  const handleVote = async (reviewId: string) => {
    await marketplaceOptimizationService.voteReview(reviewId, true);
    void loadReviews();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-subtle bg-elevated/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-foreground">{t('shop.reviewsTitle')}</h2>
        <ProductRating avgRating={avgRating} reviewCount={reviewCount} size="md" />
      </div>

      {eligibility?.canReview ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-xl border border-subtle p-4">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t('shop.verifiedPurchaseBadge')}
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">{t('shop.reviewRating')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`rounded p-1 ${n <= rating ? 'text-amber-400' : 'text-gray-400'}`}
                  aria-label={`${n} stars`}
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('shop.reviewTitlePlaceholder')}
            className="w-full rounded-lg border border-subtle bg-transparent px-3 py-2 text-sm"
            maxLength={120}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('shop.reviewBodyPlaceholder')}
            className="min-h-[80px] w-full rounded-lg border border-subtle bg-transparent px-3 py-2 text-sm"
            required
            minLength={10}
            maxLength={4000}
          />
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || body.trim().length < 10}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? t('shop.reviewSubmitting') : t('shop.reviewSubmit')}
          </button>
        </form>
      ) : eligibility?.reason === 'no_purchase' ? (
        <p className="text-sm text-muted">{t('shop.reviewRequiresPurchase')}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">{t('shop.loading')}</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted">{t('shop.noReviewsYet')}</p>
      ) : (
        <ul className="divide-y divide-subtle">
          {reviews.map((r) => (
            <li key={r.id} className="py-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ProductRating avgRating={r.rating} size="sm" />
                {r.isVerifiedPurchase ? (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {t('shop.verifiedPurchaseBadge')}
                  </span>
                ) : null}
                <span className="text-xs text-muted">
                  {r.user?.name || t('shop.anonymousReviewer')} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                </span>
              </div>
              {r.title ? <p className="text-sm font-bold text-foreground">{r.title}</p> : null}
              <p className="mt-1 text-sm text-muted">{r.body}</p>
              <button
                type="button"
                onClick={() => void handleVote(r.id)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
              >
                <span className="material-symbols-outlined text-sm">thumb_up</span>
                {t('shop.reviewHelpful')} ({r.helpfulCount})
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
