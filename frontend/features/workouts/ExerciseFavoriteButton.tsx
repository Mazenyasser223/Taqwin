import React, { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { useI18n } from '../../lib/i18n/useI18n';

import { useAuthStore } from '../../store/useAuthStore';



type Props = {

  exerciseId: string;

  saved: boolean;

  loading?: boolean;

  compact?: boolean;

  className?: string;

  onToggle: (exerciseId: string, nextSaved: boolean) => void | Promise<void>;

  onLoginRequired?: () => void;

};



export function ExerciseFavoriteButton({

  exerciseId,

  saved,

  loading = false,

  compact = false,

  className = '',

  onToggle,

  onLoginRequired,

}: Props) {

  const { t } = useI18n();

  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);

  const [active, setActive] = useState(saved);



  useEffect(() => {

    setActive(saved);

  }, [saved]);



  const handleClick = (e: React.MouseEvent) => {

    e.preventDefault();

    e.stopPropagation();

    if (loading) return;

    if (!user) {

      onLoginRequired?.();

      navigate('/login');

      return;

    }

    const next = !active;

    setActive(next);

    void onToggle(exerciseId, next);

  };



  return (

    <button

      type="button"

      onClick={handleClick}

      aria-busy={loading}

      title={!user ? t('exercises.favoriteLoginRequired') : active ? t('exercises.unsaveExercise') : t('exercises.saveExercise')}

      aria-pressed={active}

      aria-label={!user ? t('exercises.favoriteLoginRequired') : active ? t('exercises.unsaveExercise') : t('exercises.saveExercise')}

      className={`inline-flex items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-200 ${

        compact ? 'size-9' : 'gap-1.5 rounded-xl px-3 py-2'

      } ${

        active

          ? 'border-red-500/50 bg-red-500/20 text-red-500 shadow-sm shadow-red-500/20 scale-105'

          : 'border-subtle/80 bg-background/80 text-muted hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5'

      } ${className}`}

    >

      <span

        className="material-symbols-outlined text-lg leading-none transition-transform duration-200"

        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}

      >

        favorite

      </span>

      {!compact ? (

        <span className="text-xs font-bold">{active ? t('exercises.saved') : t('exercises.save')}</span>

      ) : null}

    </button>

  );

}

