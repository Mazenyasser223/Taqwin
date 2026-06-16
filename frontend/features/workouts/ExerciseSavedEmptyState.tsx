import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';

export function ExerciseSavedEmptyState() {
  const { t } = useI18n();

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl border border-dashed border-subtle px-5 py-8 sm:px-8 sm:py-10 text-center">
      <span
        className="material-symbols-outlined mb-3 text-4xl text-muted"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        favorite
      </span>
      <h3 className="text-base sm:text-lg font-black text-foreground">{t('exercises.savedEmptyTitle')}</h3>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        {t('exercises.savedEmptyBody')}
      </p>
    </div>
  );
}

export function ExerciseSavedLoginPrompt() {
  const { t } = useI18n();

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl border border-subtle px-5 py-8 sm:px-8 sm:py-10 text-center">
      <span className="material-symbols-outlined mb-3 text-4xl text-primary">login</span>
      <h3 className="text-base sm:text-lg font-black text-foreground">{t('exercises.savedLoginTitle')}</h3>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        {t('exercises.savedLoginBody')}
      </p>
      <Link
        to="/login"
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
      >
        {t('auth.signIn')}
      </Link>
    </div>
  );
}
