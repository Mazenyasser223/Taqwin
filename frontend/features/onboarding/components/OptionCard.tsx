import React from 'react';
import { motion } from 'framer-motion';
import type { StepOption } from '../types';
import { ASSETS } from '../onboardingAssets';

const optionClass = (selected: boolean, compact = false) =>
  `text-left border overflow-hidden transition-all duration-200 ${
    compact ? 'rounded-2xl' : 'rounded-2xl w-full'
  } ${
    selected
      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md shadow-primary/10'
      : 'border-subtle bg-surface/80 hover:border-primary/35 hover:bg-surface'
  }`;

export function resolveOptionImage(opt: StepOption): string {
  return opt.imageUrl ?? ASSETS.default;
}

interface OptionCardProps {
  opt: StepOption;
  selected: boolean;
  onSelect: () => void;
  layout?: 'stack' | 'row';
  cardLayout?: 'default' | 'grid';
  variant?: 'default' | 'chat';
  trailing?: React.ReactNode;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  opt,
  selected,
  onSelect,
  layout = 'stack',
  cardLayout = 'default',
  variant = 'default',
  trailing,
}) => {
  const isPhoto = opt.imageVariant === 'photo';
  const isIllustration = opt.imageVariant === 'illustration' || (!isPhoto && /\.svg(\?|$)/i.test(resolveOptionImage(opt)));
  const isGrid = cardLayout === 'grid';

  if (variant === 'chat') {
    if (isGrid || isPhoto) {
      return (
        <motion.button
          type="button"
          onClick={onSelect}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className={`${optionClass(selected, true)} flex flex-col items-center p-2 min-w-[5.5rem] max-w-[7.5rem]`}
        >
          <div className="relative size-11 rounded-xl overflow-hidden bg-surface/60 ring-1 ring-inset ring-white/5">
            <img
              src={resolveOptionImage(opt)}
              alt=""
              className={`absolute inset-0 w-full h-full ${isPhoto ? 'object-cover' : 'object-contain p-1'}`}
              loading="lazy"
            />
          </div>
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

  if (isGrid) {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`${optionClass(selected)} h-full flex flex-col`}
      >
        <div className="relative w-full overflow-hidden">
          <img
            src={resolveOptionImage(opt)}
            alt=""
            className="block w-full h-auto object-contain"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/95 to-transparent pointer-events-none" />
        </div>
        <span className="px-2 py-3 text-center text-sm sm:text-base font-bold text-foreground">
          {opt.label}
        </span>
      </motion.button>
    );
  }

  const isPhotoStack = isPhoto && layout === 'stack';

  const imageFrameClass =
    layout === 'stack'
      ? isPhoto
        ? 'relative w-full overflow-hidden'
        : 'relative h-36 sm:h-40 w-full overflow-hidden bg-surface/50'
      : isPhoto
        ? 'relative h-24 w-24 flex-shrink-0 rounded-xl overflow-hidden'
        : 'relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden';

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
      className={optionClass(selected)}
    >
      <div className={layout === 'row' ? 'flex gap-4 items-center p-4' : ''}>
        <div className={imageFrameClass}>
          <img
            src={resolveOptionImage(opt)}
            alt=""
            className={imageClass}
            loading="lazy"
          />
          <div className={overlayClass} />
        </div>
        <div className={layout === 'stack' ? 'p-4 pt-3' : 'flex-1 min-w-0'}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-bold block text-foreground">{opt.label}</span>
              {opt.description && (
                <span className="text-sm text-muted mt-0.5 block">{opt.description}</span>
              )}
            </div>
            {trailing}
          </div>
        </div>
      </div>
    </motion.button>
  );
};
