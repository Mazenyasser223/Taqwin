import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { ImageLightbox } from '../../../components/ui/ImageLightbox';
import { ASSETS } from '../onboardingAssets';

/** Sample InBody report — tap to zoom. */
export const InbodyEducationIntro: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useI18n();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className="flex justify-center shrink-0">
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setPreviewOpen(true)}
          className="inline-block max-w-full rounded-lg border border-subtle bg-white overflow-hidden cursor-zoom-in group shadow-sm"
          aria-label={t('onboarding.inbody.sampleZoom')}
        >
          <img
            src={ASSETS.inbodySampleReport}
            alt={t('onboarding.inbody.sampleAlt')}
            className={`block w-auto max-w-full h-auto transition-opacity group-hover:opacity-90 ${
              compact ? 'max-h-24 sm:max-h-28' : 'max-h-36 sm:max-h-44'
            }`}
          />
        </motion.button>
      </div>

      <ImageLightbox
        open={previewOpen}
        src={ASSETS.inbodySampleReport}
        alt={t('onboarding.inbody.sampleAlt')}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};
