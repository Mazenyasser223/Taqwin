import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Modal } from '../tailadmin/Modal';
import { useI18n } from '../../lib/i18n/useI18n';
import { detectReviewRatingTextMismatch } from '../../lib/gymReviewSentiment';
import gymService from '../../services/gymService';

export interface GymReview {
  id: string;
  agoLabel: string;
  rating: number;
  body: string;
  helpfulCount: number;
  createdAt: string;
}

export interface GymReviewSummary {
  reviewCount: number;
  positive: number;
  neutral: number;
  negative: number;
  keywords: string[];
  source: 'openai' | 'stars' | 'none';
  analyzedAt: string;
}

function formatReviewAgo(iso: string, t: (key: string, params?: Record<string, string>) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return t('gyms.reviewJustNow');
  if (min < 60) return t('gyms.reviewMinutesAgo', { count: String(min) });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('gyms.reviewHoursAgo', { count: String(hr) });
  const d = Math.floor(hr / 24);
  return t('gyms.reviewDaysAgo', { count: String(d) });
}

function mapApiReview(
  row: { id: string; rating: number; body: string; helpfulCount: number; createdAt: string },
  t: (key: string, params?: Record<string, string>) => string,
): GymReview {
  return {
    id: row.id,
    agoLabel: formatReviewAgo(row.createdAt, t),
    rating: row.rating,
    body: row.body,
    helpfulCount: row.helpfulCount,
    createdAt: row.createdAt,
  };
}

interface GymMemberReviewsSectionProps {
  gymId: string;
}

function SentimentBar({
  label,
  percent,
  fillClass,
}: {
  label: string;
  percent: number;
  fillClass: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-primary">{label}</span>
        <span className="text-sm font-bold text-primary">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-elevated">
        <div className={`h-full rounded-full transition-all duration-500 ${fillClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ReviewSentimentOverview({
  summary,
  loading,
}: {
  summary: GymReviewSummary | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm sm:p-6">
        <p className="text-center text-sm text-faint">{t('gyms.sentimentAnalyzing')}</p>
      </div>
    );
  }

  if (!summary || summary.reviewCount === 0) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h5 className="text-base font-bold text-primary">{t('gyms.sentimentOverview')}</h5>
        <span className="text-xs text-faint">
          {t('gyms.sentimentBasedOn', { count: String(summary.reviewCount) })}
        </span>
        {summary.source === 'openai' ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            {t('gyms.sentimentSourceOpenai')}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
        <SentimentBar label={t('gyms.sentimentPositive')} percent={summary.positive} fillClass="bg-primary" />
        <SentimentBar label={t('gyms.sentimentNeutral')} percent={summary.neutral} fillClass="bg-slate-400" />
        <SentimentBar label={t('gyms.sentimentNegative')} percent={summary.negative} fillClass="bg-red-500" />
      </div>

      <div className="mt-5 border-t border-subtle pt-5">
        <p className="mb-3 text-sm font-bold text-primary">{t('gyms.topKeywords')}</p>
        {summary.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-faint">{t('gyms.sentimentNoKeywords')}</p>
        )}
      </div>
    </div>
  );
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconClass = size === 'md' ? 'text-xl' : 'text-base';
  return (
    <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`material-symbols-outlined ${iconClass} ${star <= rating ? 'text-accent' : 'text-faint/35'}`}
          style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </span>
      ))}
    </div>
  );
}

export const GymMemberReviewsSection: React.FC<GymMemberReviewsSectionProps> = ({ gymId }) => {
  const { t, language } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [userReviews, setUserReviews] = useState<GymReview[]>([]);
  const [summary, setSummary] = useState<GymReviewSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);

  const reviews = userReviews;
  const ratingTextMismatch = useMemo(
    () => detectReviewRatingTextMismatch(rating, body),
    [rating, body],
  );

  const loadSummary = useCallback(
    async (refresh = false) => {
      setLoadingSummary(true);
      const res = await gymService.getGymReviewSummary(gymId, refresh);
      if (res.data) setSummary(res.data);
      setLoadingSummary(false);
    },
    [gymId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingReviews(true);
    setLoadError(null);

    Promise.all([gymService.getGymReviews(gymId), gymService.getGymReviewSummary(gymId)]).then(
      ([reviewsRes, summaryRes]) => {
        if (cancelled) return;
        if (reviewsRes.error) {
          setLoadError(reviewsRes.error);
          setUserReviews([]);
        } else if (Array.isArray(reviewsRes.data)) {
          setUserReviews(reviewsRes.data.map((row) => mapApiReview(row, t)));
        }
        if (summaryRes.data) setSummary(summaryRes.data);
        setLoadingReviews(false);
        setLoadingSummary(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [gymId, t]);

  const submitReview = async () => {
    const trimmed = body.trim();
    if (!trimmed || rating < 1 || submitting) return;

    if (ratingTextMismatch && !mismatchAcknowledged) {
      setMismatchAcknowledged(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const res = await gymService.submitGymReview(gymId, { rating, body: trimmed });
    setSubmitting(false);

    if (res.error) {
      setSubmitError(res.error);
      return;
    }

    const saved = res.data;
    if (saved) {
      setUserReviews((prev) => [
        mapApiReview(saved, t),
        ...prev.filter((review) => review.id !== saved.id),
      ]);
    }
    setBody('');
    setRating(5);
    setMismatchAcknowledged(false);
    setSubmitError(null);
    setModalOpen(false);

    void loadSummary(true);
  };

  const toggleHelpful = (reviewId: string) => {
    setHelpfulVotes((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-primary">{t('gyms.memberReviews')}</h4>
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setMismatchAcknowledged(false);
            setModalOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition hover:opacity-95 sm:px-5 sm:py-2.5 sm:text-sm"
        >
          <span className="material-symbols-outlined text-lg">rate_review</span>
          {t('gyms.writeReview')}
        </button>
      </div>

      <ReviewSentimentOverview summary={summary} loading={loadingSummary && !summary} />

      <div className="space-y-3">
        {loadingReviews ? (
          <p className="rounded-2xl border border-dashed border-subtle bg-elevated/50 px-4 py-6 text-center text-sm text-faint">
            {t('common.loading')}
          </p>
        ) : null}
        {!loadingReviews && loadError ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        ) : null}
        {!loadingReviews && !loadError && reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-subtle bg-elevated/50 px-4 py-6 text-center text-sm text-faint">
            {t('gyms.reviewsEmpty')}
          </p>
        ) : null}
        {reviews.map((review) => {
          const voted = helpfulVotes[review.id];
          const helpfulCount = review.helpfulCount + (voted ? 1 : 0);
          return (
            <article
              key={review.id}
              className="rounded-2xl border border-subtle bg-elevated p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-faint">{review.agoLabel}</p>
                <StarRating rating={review.rating} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{review.body}</p>
              <button
                type="button"
                onClick={() => toggleHelpful(review.id)}
                className={`mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  voted ? 'text-accent' : 'text-faint hover:text-muted'
                }`}
              >
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: voted ? "'FILL' 1" : "'FILL' 0" }}
                >
                  thumb_up
                </span>
                {t('gyms.reviewHelpful', { count: String(helpfulCount) })}
              </button>
            </article>
          );
        })}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <Modal
            title={t('gyms.writeReview')}
            subtitle={t('gyms.reviewModalHint')}
            onClose={() => {
              setSubmitError(null);
              setMismatchAcknowledged(false);
              setModalOpen(false);
            }}
          >
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{t('gyms.reviewRating')}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setRating(star);
                        setMismatchAcknowledged(false);
                      }}
                      aria-label={`${star} / 5`}
                      className="rounded-lg p-1 transition hover:bg-elevated-hover"
                    >
                      <span
                        className={`material-symbols-outlined text-3xl ${star <= rating ? 'text-accent' : 'text-faint/35'}`}
                        style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="gym-review-body" className="mb-2 block text-xs font-bold uppercase tracking-wide text-faint">
                  {t('gyms.reviewBodyLabel')}
                </label>
                <textarea
                  id="gym-review-body"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setMismatchAcknowledged(false);
                    if (submitError) setSubmitError(null);
                  }}
                  rows={5}
                  placeholder={t('gyms.reviewPlaceholder')}
                  className={`w-full resize-none rounded-xl border border-subtle bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary/40 ${
                    language === 'ar' ? 'text-right placeholder:text-right' : 'text-left placeholder:text-left'
                  }`}
                />
              </div>
              {ratingTextMismatch ? (
                <div
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
                  role="alert"
                >
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined shrink-0 text-base">warning</span>
                    <p>
                      {ratingTextMismatch === 'highStarsNegativeText'
                        ? t('gyms.reviewMismatchHighStarsNegative')
                        : t('gyms.reviewMismatchLowStarsPositive')}
                    </p>
                  </div>
                </div>
              ) : null}
              {submitError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {submitError}
                </p>
              )}
              <button
                type="button"
                onClick={submitReview}
                disabled={!body.trim() || submitting}
                className={`w-full rounded-2xl py-3.5 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:opacity-40 ${
                  ratingTextMismatch && mismatchAcknowledged
                    ? 'bg-amber-600 shadow-amber-600/20'
                    : 'bg-gradient-to-r from-primary to-accent shadow-primary/20'
                }`}
              >
                {submitting
                  ? t('common.loading')
                  : ratingTextMismatch && !mismatchAcknowledged
                    ? t('gyms.submitReview')
                    : ratingTextMismatch && mismatchAcknowledged
                      ? t('gyms.submitReviewAnyway')
                      : t('gyms.submitReview')}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};
