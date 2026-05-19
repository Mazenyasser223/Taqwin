import React from 'react';
import { motion } from 'framer-motion';
import type { StepOption } from '../types';
import { ASSETS } from '../onboardingAssets';

const optionClass = (selected: boolean) =>
  `w-full text-left rounded-2xl border overflow-hidden transition-all duration-200 ${
    selected
      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-lg shadow-primary/10'
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
  trailing?: React.ReactNode;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  opt,
  selected,
  onSelect,
  layout = 'stack',
  cardLayout = 'default',
  trailing,
}) => {
  const isPhoto = opt.imageVariant === 'photo';
  const isIllustration = opt.imageVariant === 'illustration' || (!isPhoto && /\.svg(\?|$)/i.test(resolveOptionImage(opt)));
  const isGrid = cardLayout === 'grid';

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
