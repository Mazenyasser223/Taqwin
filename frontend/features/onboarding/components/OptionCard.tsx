import React from 'react';
import { motion } from 'framer-motion';
import type { StepOption } from '../types';
import { ASSETS } from '../onboardingAssets';

const optionClass = (selected: boolean, compact = false, separated = false) =>
  `text-left border overflow-hidden transition-all duration-200 ${
    compact ? 'rounded-2xl' : 'rounded-2xl w-full'
  } ${
    separated
      ? selected
        ? 'border-2 border-primary bg-primary/10 ring-2 ring-primary/25 shadow-md shadow-primary/10'
        : 'border-2 border-subtle bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)] hover:border-primary/45 hover:bg-surface'
      : selected
        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md shadow-primary/10'
        : 'border-subtle bg-surface/80 hover:border-primary/35 hover:bg-surface'
  }`;

export function resolveOptionImage(opt: StepOption): string {
  return opt.imageUrl ?? ASSETS.default;
}

function hasRealImage(opt: StepOption): boolean {
  return Boolean(!opt.icon && opt.imageUrl && opt.imageUrl !== ASSETS.default);
}

function OptionIconVisual({
  opt,
  compact = false,
  frame = 'grid',
}: {
  opt: StepOption;
  compact?: boolean;
  frame?: 'grid' | 'chat' | 'row';
}) {
  if (!opt.icon) return null;

  const tone = opt.iconClass ?? 'text-primary';

  if (frame === 'chat') {
    return (
      <div className="relative size-11 rounded-xl overflow-hidden bg-surface/60 ring-1 ring-inset ring-white/5 flex items-center justify-center">
        <span className={`material-symbols-outlined text-[1.75rem] ${tone}`}>{opt.icon}</span>
      </div>
    );
  }

  if (frame === 'row') {
    return (
      <div className="relative h-12 w-12 flex-shrink-0 rounded-xl bg-surface/60 ring-1 ring-inset ring-white/5 flex items-center justify-center">
        <span className={`material-symbols-outlined text-3xl ${tone}`}>{opt.icon}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden flex items-center justify-center bg-surface/40 ${
        compact ? 'aspect-[4/3] max-h-[3.25rem] sm:max-h-20 min-h-0' : 'aspect-[4/3] min-h-[5rem] sm:min-h-[6rem]'
      }`}
    >
      <span className={`material-symbols-outlined ${compact ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl'} ${tone}`}>
        {opt.icon}
      </span>
    </div>
  );
}

interface OptionCardProps {
  opt: StepOption;
  selected: boolean;
  onSelect: () => void;
  layout?: 'stack' | 'row';
  cardLayout?: 'default' | 'grid';
  variant?: 'default' | 'chat';
  compact?: boolean;
  dense?: boolean;
  /** Stretch option to fill grid row height (text-only multi steps) */
  fillHeight?: boolean;
  /** Stronger borders and spacing for stacked single-select lists */
  separated?: boolean;
  trailing?: React.ReactNode;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  opt,
  selected,
  onSelect,
  layout = 'stack',
  cardLayout = 'default',
  variant = 'default',
  compact = false,
  dense = false,
  fillHeight = false,
  separated = false,
  trailing,
}) => {
  const isPhoto = opt.imageVariant === 'photo';
  const isIllustration = opt.imageVariant === 'illustration' || (!isPhoto && /\.svg(\?|$)/i.test(resolveOptionImage(opt)));
  const isFigureIllustration =
    isIllustration && /\/body-(ectomorph|mesomorph|endomorph)\.(png|webp|jpg)/i.test(resolveOptionImage(opt));
  const isLevelIllustration =
    isIllustration && /\/level-(beginner|intermediate|advanced)\.svg/i.test(resolveOptionImage(opt));
  const isGrid = cardLayout === 'grid';

  if (variant === 'chat') {
    if (isGrid || isPhoto || opt.icon) {
      return (
        <motion.button
          type="button"
          onClick={onSelect}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className={`${optionClass(selected, true)} flex flex-col items-center p-2 min-w-[5.5rem] max-w-[7.5rem]`}
        >
          {opt.icon ? (
            <OptionIconVisual opt={opt} frame="chat" />
          ) : (
            <div className="relative size-11 rounded-xl overflow-hidden bg-surface/60 ring-1 ring-inset ring-white/5">
              <img
                src={resolveOptionImage(opt)}
                alt=""
                className={`absolute inset-0 w-full h-full ${isPhoto ? 'object-cover' : 'object-contain p-1'}`}
                loading="lazy"
              />
            </div>
          )}
          <span className="mt-1.5 text-[11px] sm:text-xs font-bold text-center leading-tight text-foreground line-clamp-2">
            {opt.label}
          </span>
        </motion.button>
      );
    }

    return (
      <motion.button
        type="button"
        onClick={onSelect}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`${optionClass(selected, true)} flex items-center gap-2.5 px-3 py-2.5 w-full`}
      >
        <motion.div className="relative size-9 rounded-xl overflow-hidden bg-surface/60 shrink-0 ring-1 ring-inset ring-white/5">
          <img
            src={resolveOptionImage(opt)}
            alt=""
            className={`absolute inset-0 w-full h-full ${isIllustration ? 'object-contain p-0.5' : 'object-cover'}`}
            loading="lazy"
          />
        </motion.div>
        <span className="flex-1 min-w-0 text-sm font-bold text-foreground leading-snug">{opt.label}</span>
        {trailing ?? (
          <span
            className={`size-5 rounded-full border shrink-0 flex items-center justify-center ${
              selected ? 'bg-primary border-primary' : 'border-subtle bg-background/40'
            }`}
          >
            {selected && <span className="size-2 rounded-full bg-white" />}
          </span>
        )}
      </motion.button>
    );
  }

  if (compact && layout === 'row' && !hasRealImage(opt) && !opt.icon) {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`${optionClass(selected, true, separated)} w-full text-start flex items-center ${
          fillHeight ? 'h-full min-h-0' : ''
        } ${
          dense
            ? 'px-3 py-2.5 gap-2 rounded-xl min-h-[2.75rem]'
            : separated
              ? 'px-3.5 py-3 gap-2.5 min-h-[3rem]'
              : 'px-3 py-2.5 gap-2.5 min-h-[2.875rem]'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span
            className={`font-bold text-foreground block leading-snug questionnaire-option-label ${
              dense ? '' : 'sm:text-base'
            }`}
          >
            {opt.label}
          </span>
          {opt.description && !dense && (
            <span className="text-[11px] sm:text-xs text-muted mt-0.5 block line-clamp-2 leading-snug questionnaire-option-desc">
              {opt.description}
            </span>
          )}
        </div>
        {trailing ?? (
          <span
            className={`rounded-full border shrink-0 flex items-center justify-center ${
              dense ? 'size-4' : 'size-5'
            } ${
              selected ? 'bg-primary border-primary' : 'border-subtle bg-background/40'
            }`}
          >
            {selected && <span className={`rounded-full bg-white ${dense ? 'size-1.5' : 'size-2'}`} />}
          </span>
        )}
      </motion.button>
    );
  }

  if (isGrid) {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`${optionClass(selected, compact, separated)} h-full min-h-0 flex flex-col ${compact ? 'rounded-xl sm:rounded-2xl' : ''}`}
      >
        <div
          className={`relative w-full min-h-0 flex-1 flex items-end justify-center ${
            isFigureIllustration
              ? 'overflow-visible px-0.5 pb-0'
              : `overflow-hidden ${
                  compact && !isPhoto && !isLevelIllustration ? 'max-h-[3.5rem] sm:max-h-none' : ''
                }`
          }`}
        >
          {opt.icon ? (
            <OptionIconVisual opt={opt} compact={compact} frame="grid" />
          ) : (
            <>
              <img
                src={resolveOptionImage(opt)}
                alt=""
                className={`block ${
                  compact
                    ? isPhoto
                      ? 'w-full h-full min-h-[5.5rem] sm:min-h-[7.5rem] object-cover object-[center_20%]'
                      : isFigureIllustration
                        ? 'h-[94%] max-h-full w-auto max-w-[108%] object-contain object-bottom scale-[1.06] sm:scale-[1.1] origin-bottom'
                        : isLevelIllustration
                          ? 'w-full h-full min-h-[6.5rem] sm:min-h-[8.25rem] object-contain p-0.5 scale-[1.08] sm:scale-[1.14]'
                          : `w-full h-full max-h-[5.5rem] sm:max-h-[7.5rem] object-contain p-1 sm:p-1.5 ${
                              isIllustration ? 'scale-[0.98]' : ''
                            }`
                    : isPhoto
                      ? 'w-full h-auto min-h-[8rem] object-cover object-[center_20%]'
                      : isFigureIllustration
                        ? 'h-[94%] max-h-full w-auto max-w-[108%] object-contain object-bottom scale-[1.08] origin-bottom'
                        : 'w-full h-auto object-contain'
                }`}
                loading="lazy"
              />
              {!isFigureIllustration && (
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/95 to-transparent pointer-events-none" />
              )}
            </>
          )}
        </div>
        <span
          className={`text-center font-bold text-foreground shrink-0 ${
            compact
              ? 'px-1 py-1 text-[10px] sm:text-sm leading-tight line-clamp-2 sm:px-2 sm:py-2'
              : 'px-2 py-3 text-sm sm:text-base'
          }`}
        >
          {opt.label}
        </span>
      </motion.button>
    );
  }

  const isPhotoStack = isPhoto && layout === 'stack';

  const showImage = hasRealImage(opt);
  const showIcon = Boolean(opt.icon);

  const imageFrameClass =
    layout === 'stack'
      ? isPhoto
        ? 'relative w-full overflow-hidden'
        : showImage
          ? `relative w-full overflow-hidden bg-surface/50 ${compact ? 'h-24 sm:h-32' : 'h-36 sm:h-40'}`
          : ''
      : isPhoto
        ? `relative flex-shrink-0 rounded-xl overflow-hidden ${compact ? 'h-12 w-12' : 'h-24 w-24'}`
        : showImage
          ? `relative flex-shrink-0 rounded-xl overflow-hidden ${compact ? 'h-12 w-12' : 'h-20 w-20'}`
          : '';

  const imageClass = isPhotoStack
    ? 'block w-full h-auto max-w-full'
    : isIllustration
      ? 'absolute inset-0 w-full h-full object-contain object-center p-2'
      : 'absolute inset-0 w-full h-full object-cover object-center';

  const overlayClass = isPhoto
    ? 'absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/95 to-transparent pointer-events-none'
    : 'absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none';

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={optionClass(selected, compact, separated)}
    >
      <div
        className={
          layout === 'row'
            ? `flex items-center ${compact ? 'gap-3 p-2.5 sm:p-3' : 'gap-4 p-4'}`
            : ''
        }
      >
        {showIcon ? (
          <OptionIconVisual opt={opt} compact={compact} frame={layout === 'row' ? 'row' : 'grid'} />
        ) : showImage && imageFrameClass ? (
          <div className={imageFrameClass}>
            <img
              src={resolveOptionImage(opt)}
              alt=""
              className={imageClass}
              loading="lazy"
            />
            <div className={overlayClass} />
          </div>
        ) : null}
        <div className={layout === 'stack' ? (compact ? 'p-3' : 'p-4 pt-3') : 'flex-1 min-w-0'}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={`font-bold block text-foreground questionnaire-option-label ${compact ? 'text-sm' : ''}`}>
                {opt.label}
              </span>
              {opt.description && (
                <span className={`text-muted mt-0.5 block ${compact ? 'text-xs' : 'text-sm'}`}>
                  {opt.description}
                </span>
              )}
            </div>
            {trailing}
          </div>
        </div>
      </div>
    </motion.button>
  );
};
