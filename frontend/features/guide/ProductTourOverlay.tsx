import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { ProductTourStep } from '../../lib/productTour/types';
import { cn } from '../../lib/cn';
import { measureTourStepLayout } from './measureTourTarget';
import type { TourLayout } from './productTourLayout';

type Props = {
  open: boolean;
  steps: ProductTourStep[];
  stepIndex: number;
  transitioning?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

type TourCardProps = {
  step: ProductTourStep;
  stepIndex: number;
  totalSteps: number;
  isLast: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  style?: React.CSSProperties;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

function TourProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-muted tabular-nums">
          {current} / {total}
        </span>
        <span className="text-[11px] font-semibold text-primary tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/90"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />
      </div>
    </div>
  );
}

function TourCard({
  step,
  stepIndex,
  totalSteps,
  isLast,
  cardRef,
  className,
  style,
  onNext,
  onBack,
  onSkip,
}: TourCardProps) {
  const { t } = useI18n();

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'pointer-events-auto overflow-hidden rounded-3xl border border-white/15',
        'bg-gradient-to-b from-surface/98 to-surface/92 backdrop-blur-xl',
        'shadow-[0_24px_60px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]',
        className,
      )}
      style={style}
    >
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <div className="p-5 sm:p-6 text-start">
        {step.sectionKey ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
            <span className="material-symbols-outlined text-[13px] leading-none">explore</span>
            {t(step.sectionKey)}
          </span>
        ) : null}

        <TourProgressBar current={stepIndex + 1} total={totalSteps} />

        <h2 id="product-tour-title" className="text-lg sm:text-xl font-bold text-foreground leading-snug">
          {t(step.titleKey)}
        </h2>
        <p className="mt-2.5 text-sm sm:text-[15px] text-muted leading-relaxed">{t(step.bodyKey)}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="me-auto text-xs font-semibold text-muted hover:text-foreground px-2 py-2 transition-colors"
          >
            {t('tour.skip')}
          </button>
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-white/10 transition-colors"
            >
              {t('tour.back')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 hover:brightness-110 transition-all"
          >
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export const ProductTourOverlay: React.FC<Props> = ({
  open,
  steps,
  stepIndex,
  transitioning = false,
  onNext,
  onBack,
  onSkip,
}) => {
  const { t } = useI18n();
  const step = steps[stepIndex];
  const cardRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const [tooltipH, setTooltipH] = useState(200);

  useLayoutEffect(() => {
    if (!open || !step || transitioning) {
      setLayout(null);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const applyLayout = (scroll: boolean) => {
      if (cancelled) return;
      const next = measureTourStepLayout(step, cardRef.current?.offsetHeight ?? tooltipH, scroll);
      if (next) setLayout(next);
    };

    const scheduleMeasure = (scroll: boolean) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => applyLayout(scroll));
      });
    };

    scrollDoneRef.current = false;
    scheduleMeasure(true);

    const t1 = window.setTimeout(() => scheduleMeasure(false), 500);
    const t2 = window.setTimeout(() => scheduleMeasure(false), 1000);

    const onResize = () => scheduleMeasure(false);
    window.addEventListener('resize', onResize, { passive: true });

    const el = document.querySelector(`[data-tour="${step.id}"]`) as HTMLElement | null;
    if (el && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleMeasure(false));
      resizeObserver.observe(el);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [open, step, stepIndex, transitioning, tooltipH]);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const h = cardRef.current.offsetHeight;
    if (h > 0 && Math.abs(h - tooltipH) > 4) setTooltipH(h);
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !step || typeof document === 'undefined') return null;

  const isLast = stepIndex >= steps.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-tour-title"
      aria-busy={transitioning || undefined}
    >
      {layout ? (
        <motion.div
          className="pointer-events-none fixed rounded-2xl sm:rounded-3xl"
          initial={false}
          animate={{
            top: layout.spotlight.top,
            left: layout.spotlight.left,
            width: layout.spotlight.width,
            height: layout.spotlight.height,
          }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          style={{
            boxShadow:
              '0 0 0 2px color-mix(in srgb, var(--color-primary, #6366f1) 90%, white), 0 0 32px color-mix(in srgb, var(--color-primary, #6366f1) 40%, transparent), 0 0 0 9999px rgba(0, 0, 0, 0.58)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/58 backdrop-blur-[2px]" aria-hidden />
      )}

      {!layout?.mobileSheet && layout ? (
        <div
          className="pointer-events-none fixed z-[9999] h-3 w-3 rotate-45 rounded-sm bg-surface/95 border border-white/15"
          style={{
            top: layout.arrow.top,
            left: layout.arrow.left,
            transform: `rotate(${layout.arrow.rotate + 45}deg)`,
          }}
        />
      ) : null}

      {layout && !transitioning ? (
        <TourCard
          step={step}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          isLast={isLast}
          cardRef={cardRef}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          className="fixed z-[9999]"
          style={{
            top: layout.tooltip.top,
            left: layout.tooltip.left,
            width: layout.tooltip.width,
          }}
        />
      ) : (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
          <TourCard
            step={step}
            stepIndex={stepIndex}
            totalSteps={steps.length}
            isLast={isLast}
            cardRef={cardRef}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            className="pointer-events-auto w-full max-w-[min(420px,calc(100vw-2rem))]"
          />
        </div>
      )}

      {transitioning ? (
        <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/35 backdrop-blur-[1px] pointer-events-none">
          <div className="rounded-2xl border border-white/12 bg-surface/95 px-6 py-4 shadow-xl flex items-center gap-3 pointer-events-none">
            <span className="material-symbols-outlined text-2xl text-primary animate-spin">progress_activity</span>
            <p className="text-sm font-semibold text-foreground">{t('tour.loadingPage')}</p>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
};
