import React from 'react';
import { motion } from 'framer-motion';
import type { StepOption } from '../types';
import { ASSETS } from '../onboardingAssets';

const optionClass = (selected: boolean) =>
  `w-full text-left rounded-2xl border overflow-hidden transition-all duration-200 ${
    selected
      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-lg shadow-primary/10'
      : 'border-white/10 bg-surface/80 hover:border-primary/35 hover:bg-surface'
  }`;

export function resolveOptionImage(opt: StepOption): string {
  return opt.imageUrl ?? ASSETS.default;
}

interface OptionCardProps {
  opt: StepOption;
  selected: boolean;
  onSelect: () => void;
  layout?: 'stack' | 'row';
  trailing?: React.ReactNode;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  opt,
  selected,
  onSelect,
  layout = 'stack',
  trailing,
}) => (
  <motion.button
    type="button"
    onClick={onSelect}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    className={optionClass(selected)}
  >
    <div className={layout === 'row' ? 'flex gap-4 items-center p-4' : ''}>
      <div className={layout === 'stack' ? 'relative h-32 w-full overflow-hidden' : 'relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden'}>
        <img
          src={resolveOptionImage(opt)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>
      <div className={layout === 'stack' ? 'p-4 pt-3' : 'flex-1 min-w-0'}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-bold block text-white">{opt.label}</span>
            {opt.description && (
              <span className="text-sm text-slate-400 mt-0.5 block">{opt.description}</span>
            )}
          </div>
          {trailing}
        </div>
      </div>
    </div>
  </motion.button>
);
