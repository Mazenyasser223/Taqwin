import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type SocialChallengeOption,
  type SocialDuel,
  type SocialFriend,
  type SocialOverview,
  type SocialSquad,
} from '../../services/gamificationService';

const CARD =
  'rounded-xl border border-gray-200/80 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-[#0c1220]/90';

function challengeKey(slug: string) {
  return `compete.challenge.${slug}.title` as import('../../lib/i18n/translations').TranslationKey;
}

function friendLabel(friend: SocialFriend) {
  return friend.displayName || friend.handle || friend.email?.split('@')[0] || 'Friend';
}

function DuelCard({
  duel,
  onAccept,
  onDecline,
  onCancel,
  busy,
}: {
  duel: SocialDuel;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  busy: string | null;
}) {
  const { t } = useI18n();
  const title = t(challengeKey(duel.templateSlug));
  const name = duel.opponent ? friendLabel(duel.opponent) : '—';

  return (
    <div className={cn(CARD, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {duel.status === 'pending'
              ? duel.role === 'opponent'
                ? t('compete.duelInviteFrom', { name })
                : t('compete.duelPendingTo', { name })
              : t('compete.duelVs', { name })}
          </p>
        </div>
        <span className="material-symbols-outlined text-brand-500">{duel.icon}</span>
      </div>

      {duel.status === 'active' && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg bg-brand-500/10 px-2 py-2">
            <p className="font-bold text-brand-600 dark:text-brand-400">{duel.myProgressPct ?? 0}%</p>
            <p className="text-gray-500">{t('compete.you')}</p>
          </div>
          <div className="rounded-lg bg-gray-100 px-2 py-2 dark:bg-gray-800">
            <p className="font-bold text-gray-800 dark:text-gray-200">{duel.theirProgressPct ?? 0}%</p>
            <p className="text-gray-500">{name}</p>
          </div>
        </div>
      )}

      {duel.status === 'pending' && duel.role === 'opponent' && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy === duel.id}
            onClick={() => onAccept?.(duel.id)}
            className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {t('compete.duelAccept')}
          </button>
          <button
            type="button"
            disabled={busy === duel.id}
            onClick={() => onDecline?.(duel.id)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
          >
            {t('compete.duelDecline')}
          </button>
        </div>
      )}

      {duel.status === 'pending' && duel.role === 'challenger' && (
        <button
          type="button"
          disabled={busy === duel.id}
          onClick={() => onCancel?.(duel.id)}
          className="mt-3 text-xs font-semibold text-gray-500 hover:text-red-500"
        >
          {t('compete.duelCancel')}
        </button>
      )}
    </div>
  );
}

function SquadCard({
  squad,
  onJoin,
  onStart,
  onLeave,
  busy,
}: {
  squad: SocialSquad;
  onJoin?: (id: string) => void;
  onStart?: (id: string) => void;
  onLeave?: (id: string) => void;
  busy: string | null;
}) {
  const { t } = useI18n();
  const title = squad.name || t(challengeKey(squad.templateSlug));

  return (
    <div className={cn(CARD, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t('compete.squadMembers', { count: String(squad.memberCount), max: String(squad.maxMembers) })}
          </p>
        </div>
        <span className="material-symbols-outlined text-violet-500">{squad.icon}</span>
      </div>

      {squad.status === 'active' && squad.avgProgressPct != null && (
        <p className="mt-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
          {t('compete.squadAvgProgress', { pct: String(squad.avgProgressPct) })}
        </p>
      )}

      {squad.status === 'recruiting' && !squad.isOwner && onJoin && (
        <button
          type="button"
          disabled={busy === squad.id}
          onClick={() => onJoin(squad.id)}
          className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {t('compete.squadJoin')}
        </button>
      )}

      {squad.status === 'recruiting' && squad.isOwner && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy === squad.id || squad.memberCount < 2}
            onClick={() => onStart?.(squad.id)}
            className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {t('compete.squadStart')}
          </button>
          <button
            type="button"
            disabled={busy === squad.id}
            onClick={() => onLeave?.(squad.id)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-700"
          >
            {t('compete.squadCancel')}
          </button>
        </div>
      )}
    </div>
  );
}

export const CompeteSocialPage: React.FC = () => {
  const { t } = useI18n();
  const [data, setData] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [duelFriendId, setDuelFriendId] = useState('');
  const [duelSlug, setDuelSlug] = useState('workout-7');
  const [squadSlug, setSquadSlug] = useState('workout-7');
  const [squadName, setSquadName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await gamificationService.social();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setData(res.data ?? null);
    if (res.data?.friends.length && !duelFriendId) {
      setDuelFriendId(res.data.friends[0].id);
    }
    setLoading(false);
  }, [duelFriendId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
  };

  const handleInviteDuel = async () => {
    if (!duelFriendId) return;
    setBusy('invite');
    const res = await gamificationService.inviteDuel(duelFriendId, duelSlug);
    setBusy(null);
    if (res.error) setError(res.error);
    else await load();
  };

  const handleCreateSquad = async () => {
    setBusy('squad-create');
    const res = await gamificationService.createSquad(squadSlug, squadName || undefined);
    setBusy(null);
    if (res.error) setError(res.error);
    else {
      setSquadName('');
      await load();
    }
  };

  const options: SocialChallengeOption[] = data?.challengeOptions ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('compete.socialTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('compete.socialSubtitle')}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link to="/compete/challenges" className="rounded-lg border border-gray-300 px-3 py-1.5 dark:border-gray-700">
            {t('compete.challengesTitle')}
          </Link>
          <Link to="/compete/league" className="rounded-lg border border-gray-300 px-3 py-1.5 dark:border-gray-700">
            {t('compete.leagueTitle')}
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
      )}

      {loading ? (
        <p className="text-center text-sm text-gray-500 animate-pulse">{t('compete.loadingSocial')}</p>
      ) : (
        <>
          <section className={cn(CARD, 'p-4 space-y-3')}>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('compete.duelNew')}</h2>
            {!data?.friends.length ? (
              <p className="text-xs text-gray-500">{t('compete.noMutualFriends')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={duelFriendId}
                  onChange={(e) => setDuelFriendId(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                >
                  {data.friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {friendLabel(f)}
                    </option>
                  ))}
                </select>
                <select
                  value={duelSlug}
                  onChange={(e) => setDuelSlug(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
                >
                  {options.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {t(challengeKey(o.slug))}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              disabled={!data?.friends.length || busy === 'invite'}
              onClick={() => void handleInviteDuel()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {t('compete.duelSend')}
            </button>
          </section>

          <section className={cn(CARD, 'p-4 space-y-3')}>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('compete.squadNew')}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={squadSlug}
                onChange={(e) => setSquadSlug(e.target.value)}
                className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
              >
                {options.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {t(challengeKey(o.slug))}
                  </option>
                ))}
              </select>
              <input
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                placeholder={t('compete.squadNamePlaceholder')}
                className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
              />
            </div>
            <button
              type="button"
              disabled={busy === 'squad-create'}
              onClick={() => void handleCreateSquad()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {t('compete.squadCreate')}
            </button>
          </section>

          {(data?.duels.pending.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('compete.duelPending')}</h2>
              {data!.duels.pending.map((d) => (
                <DuelCard
                  key={d.id}
                  duel={d}
                  busy={busy}
                  onAccept={(id) => run(id, () => gamificationService.acceptDuel(id))}
                  onDecline={(id) => run(id, () => gamificationService.declineDuel(id))}
                  onCancel={(id) => run(id, () => gamificationService.cancelDuel(id))}
                />
              ))}
            </section>
          )}

          {(data?.duels.active.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('compete.duelActive')}</h2>
              {data!.duels.active.map((d) => (
                <DuelCard key={d.id} duel={d} busy={busy} />
              ))}
            </section>
          )}

          {(data?.squads.recruiting.length ?? 0) + (data?.openSquads.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('compete.squadRecruiting')}</h2>
              {data!.squads.recruiting.map((s) => (
                <SquadCard
                  key={s.id}
                  squad={s}
                  busy={busy}
                  onStart={(id) => run(id, () => gamificationService.startSquad(id))}
                  onLeave={(id) => run(id, () => gamificationService.leaveSquad(id))}
                />
              ))}
              {data!.openSquads.map((s) => (
                <SquadCard
                  key={s.id}
                  squad={s}
                  busy={busy}
                  onJoin={(id) => run(id, () => gamificationService.joinSquad(id))}
                />
              ))}
            </section>
          )}

          {(data?.squads.active.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{t('compete.squadActive')}</h2>
              {data!.squads.active.map((s) => (
                <SquadCard key={s.id} squad={s} busy={busy} />
              ))}
            </section>
          )}

          {!data?.duels.pending.length &&
            !data?.duels.active.length &&
            !data?.squads.recruiting.length &&
            !data?.squads.active.length &&
            !data?.openSquads.length && (
              <p className="text-center text-sm text-gray-500">{t('compete.socialEmpty')}</p>
            )}
        </>
      )}
    </div>
  );
};
