import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { CompetePageShell } from './CompetePageShell';
import { CompeteCardSkeleton, CompeteProgressBar } from './CompeteDashboardCardShell';
import { CompeteSelect } from './CompeteSelect';
import { COMPETE_KPI_THEMES, type CompeteKpiThemeKey } from './competeDashboardStyles';
import { challengeKey } from './challengeUiShared';
import { useAuthStore } from '../../store/useAuthStore';

const ERROR_CARD =
  'rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';

const INPUT =
  'field-input !rounded-xl !px-3 !py-2.5 !text-sm';

function friendLabel(friend: SocialFriend) {
  if (friend.displayName) return friend.displayName;
  if (friend.handle) return `@${friend.handle.replace(/^@/, '')}`;
  return friend.email?.split('@')[0] || 'Friend';
}

function friendAvatar(friend: SocialFriend | null | undefined) {
  return friend?.communityAvatarUrl || friend?.avatarUrl || null;
}

function ThemedPanel({
  themeKey,
  icon,
  title,
  children,
}: {
  themeKey: CompeteKpiThemeKey;
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const theme = COMPETE_KPI_THEMES[themeKey];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
        ['--compete-accent' as string]: theme.accent,
        ['--compete-glow' as string]: theme.glow,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl"
        style={{ background: theme.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', theme.wash)} />

      <div className="relative z-[1] space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/20',
              theme.iconFrom,
              theme.iconTo,
            )}
            style={{ boxShadow: `0 8px 20px -6px ${theme.glow}` }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: theme.accent }}>
              {icon}
            </span>
          </div>
          <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-gray-400">{icon}</span>
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
        {count != null && count > 0 ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {count}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
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
  const theme = COMPETE_KPI_THEMES.duel;
  const title = t(challengeKey(duel.templateSlug, 'title'));
  const opponent = duel.opponent;
  const name = opponent ? friendLabel(opponent) : '—';
  const avatar = friendAvatar(opponent);
  const myPct = duel.myProgressPct ?? 0;
  const theirPct = duel.theirProgressPct ?? 0;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 6px 24px -8px ${theme.glow}`,
        ['--compete-accent' as string]: theme.accent,
        ['--compete-glow' as string]: theme.glow,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/15',
            theme.iconFrom,
            theme.iconTo,
          )}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ color: theme.accent }}>
            {duel.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {duel.status === 'pending'
              ? duel.role === 'opponent'
                ? t('compete.duelInviteFrom', { name })
                : t('compete.duelPendingTo', { name })
              : t('compete.duelVs', { name })}
          </p>
        </div>
        {duel.status === 'pending' ? (
          <span className="shrink-0 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t('compete.status.pending')}
          </span>
        ) : null}
      </div>

      {duel.status === 'active' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 ring-2 ring-brand-500/30">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{t('compete.you')}</span>
            </div>
            <div className="min-w-0 flex-1">
              <CompeteProgressBar pct={myPct} label={t('compete.you')} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-200 dark:bg-white/10 dark:ring-white/10">
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-[18px] text-gray-400">person</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CompeteProgressBar pct={theirPct} label={name} />
            </div>
          </div>
        </div>
      )}

      {duel.status === 'pending' && duel.role === 'opponent' && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy === duel.id}
            onClick={() => onAccept?.(duel.id)}
            className="flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ background: theme.accent, boxShadow: `0 4px 14px -4px ${theme.glow}` }}
          >
            {t('compete.duelAccept')}
          </button>
          <button
            type="button"
            disabled={busy === duel.id}
            onClick={() => onDecline?.(duel.id)}
            className="rounded-xl border border-gray-200/90 px-3 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-white/12 dark:text-gray-300 dark:hover:bg-white/[0.04]"
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
          className="mt-3 text-xs font-semibold text-gray-500 transition hover:text-red-500"
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
  viewerId,
}: {
  squad: SocialSquad;
  onJoin?: (id: string) => void;
  onStart?: (id: string) => void;
  onLeave?: (id: string) => void;
  busy: string | null;
  viewerId?: string | null;
}) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.squad;
  const title = squad.name || t(challengeKey(squad.templateSlug, 'title'));
  const memberPct = squad.maxMembers > 0 ? Math.round((squad.memberCount / squad.maxMembers) * 100) : 0;
  const isMember = Boolean(viewerId && squad.members.some((m) => m.userId === viewerId));

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 6px 24px -8px ${theme.glow}`,
        ['--compete-accent' as string]: theme.accent,
        ['--compete-glow' as string]: theme.glow,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/15',
            theme.iconFrom,
            theme.iconTo,
          )}
        >
          <span className="material-symbols-outlined text-[20px]" style={{ color: theme.accent }}>
            {squad.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('compete.squadMembers', { count: String(squad.memberCount), max: String(squad.maxMembers) })}
          </p>
        </div>
      </div>

      {squad.status === 'recruiting' ? (
        <CompeteProgressBar
          pct={memberPct}
          label={t('compete.squadMembers', { count: String(squad.memberCount), max: String(squad.maxMembers) })}
        />
      ) : squad.avgProgressPct != null ? (
        <CompeteProgressBar pct={squad.avgProgressPct} label={t('compete.squadProgressLabel')} />
      ) : null}

      {squad.status === 'recruiting' && !squad.isOwner && !isMember && onJoin && (
        <button
          type="button"
          disabled={busy === squad.id}
          onClick={() => onJoin(squad.id)}
          className="mt-4 w-full rounded-xl px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: theme.accent, boxShadow: `0 4px 14px -4px ${theme.glow}` }}
        >
          {t('compete.squadJoin')}
        </button>
      )}

      {squad.status === 'recruiting' && !squad.isOwner && isMember && onLeave && (
        <button
          type="button"
          disabled={busy === squad.id}
          onClick={() => onLeave(squad.id)}
          className="mt-4 w-full rounded-xl border border-gray-200/90 px-3 py-2.5 text-xs font-semibold text-gray-600 dark:border-white/12 dark:text-gray-300"
        >
          {t('compete.squadLeave')}
        </button>
      )}

      {squad.status === 'recruiting' && squad.isOwner && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy === squad.id || squad.memberCount < 2}
            onClick={() => onStart?.(squad.id)}
            className="flex-1 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ background: theme.accent, boxShadow: `0 4px 14px -4px ${theme.glow}` }}
          >
            {t('compete.squadStart')}
          </button>
          <button
            type="button"
            disabled={busy === squad.id}
            onClick={() => onLeave?.(squad.id)}
            className="rounded-xl border border-gray-200/90 px-3 py-2.5 text-xs font-semibold text-gray-600 dark:border-white/12 dark:text-gray-300"
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
  const viewerId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [duelFriendId, setDuelFriendId] = useState('');
  const [duelSlug, setDuelSlug] = useState('workout-7');
  const [squadSlug, setSquadSlug] = useState('workout-7');
  const [squadName, setSquadName] = useState('');
  const friendInitialized = useRef(false);

  const reload = useCallback(async () => {
    const res = await gamificationService.social();
    if (res.error) return { error: res.error as string };
    setData(res.data ?? null);
    if (res.data?.friends.length && !friendInitialized.current) {
      friendInitialized.current = true;
      setDuelFriendId(res.data.friends[0].id);
    }
    return { error: null as string | null };
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const result = await reload();
      setLoading(false);
      if (result.error) setError(result.error);
    })();
  }, [reload]);

  const run = async (id: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(id);
    setError(null);
    const res = await fn();
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    const refresh = await reload();
    if (refresh.error) setError(refresh.error);
  };

  const handleInviteDuel = async () => {
    if (!duelFriendId) return;
    setBusy('invite');
    const res = await gamificationService.inviteDuel(duelFriendId, duelSlug);
    setBusy(null);
    if (res.error) setError(res.error);
    else await reload();
  };

  const handleCreateSquad = async () => {
    setBusy('squad-create');
    const res = await gamificationService.createSquad(squadSlug, squadName || undefined);
    setBusy(null);
    if (res.error) setError(res.error);
    else {
      setSquadName('');
      await reload();
    }
  };

  const options: SocialChallengeOption[] = data?.challengeOptions ?? [];
  const challengeOptions = options.map((o) => ({
    value: o.slug,
    label: t(challengeKey(o.slug, 'title')),
  }));
  const friendOptions =
    data?.friends.map((f) => ({ value: f.id, label: friendLabel(f) })) ?? [];
  const recruitingIds = new Set((data?.squads.recruiting ?? []).map((s) => s.id));
  const joinableSquads = (data?.openSquads ?? []).filter(
    (s) => !recruitingIds.has(s.id) && !s.members.some((m) => m.userId === viewerId),
  );
  const duelTheme = COMPETE_KPI_THEMES.duel;
  const squadTheme = COMPETE_KPI_THEMES.squad;

  const hasActivity =
    (data?.duels.pending.length ?? 0) > 0 ||
    (data?.duels.active.length ?? 0) > 0 ||
    (data?.squads.recruiting.length ?? 0) > 0 ||
    joinableSquads.length > 0 ||
    (data?.squads.active.length ?? 0) > 0;

  return (
    <CompetePageShell
      title={t('compete.socialTitle')}
      subtitle={t('compete.socialSubtitle')}
      action={
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Link
            to="/compete/challenges"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#f37021]/35 bg-[#f37021]/10 px-3 py-1.5 text-[11px] font-semibold text-[#f37021] transition hover:bg-[#f37021]/15 sm:text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">flag</span>
            {t('compete.challengesTitle')}
          </Link>
          <Link
            to="/compete/league"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200/90 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:text-gray-200 sm:text-xs"
          >
            <span className="material-symbols-outlined text-[16px]">emoji_events</span>
            {t('compete.leagueTitle')}
          </Link>
        </div>
      }
    >
      {error ? <div className={cn(ERROR_CARD, 'mb-4')}>{error}</div> : null}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CompeteCardSkeleton theme="duel" />
          <CompeteCardSkeleton theme="squad" />
        </div>
      ) : (
        <div className={cn('space-y-8', loading && 'pointer-events-none opacity-60')}>
          <div className="grid gap-4 md:grid-cols-2">
            <ThemedPanel themeKey="duel" icon="person_2" title={t('compete.duelNew')}>
              {!data?.friends.length ? (
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {t('compete.noMutualFriends')}
                </p>
              ) : (
                <div className="space-y-3">
                  <CompeteSelect
                    label={t('compete.friendSelectLabel')}
                    value={duelFriendId}
                    options={friendOptions}
                    onChange={setDuelFriendId}
                  />
                  <CompeteSelect
                    label={t('compete.challengesTitle')}
                    value={duelSlug}
                    options={challengeOptions}
                    onChange={setDuelSlug}
                  />
                </div>
              )}
              <button
                type="button"
                disabled={!data?.friends.length || busy === 'invite'}
                onClick={() => void handleInviteDuel()}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                style={{
                  background: duelTheme.accent,
                  boxShadow: `0 6px 20px -6px ${duelTheme.glow}`,
                }}
              >
                {t('compete.duelSend')}
              </button>
            </ThemedPanel>

            <ThemedPanel themeKey="squad" icon="groups" title={t('compete.squadNew')}>
              <div className="space-y-3">
                <CompeteSelect
                  label={t('compete.challengesTitle')}
                  value={squadSlug}
                  options={challengeOptions}
                  onChange={setSquadSlug}
                />
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {t('compete.squadNamePlaceholder')}
                  </span>
                  <input
                    value={squadName}
                    onChange={(e) => setSquadName(e.target.value)}
                    placeholder={t('compete.squadNamePlaceholder')}
                    className={INPUT}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy === 'squad-create'}
                onClick={() => void handleCreateSquad()}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                style={{
                  background: squadTheme.accent,
                  boxShadow: `0 6px 20px -6px ${squadTheme.glow}`,
                }}
              >
                {t('compete.squadCreate')}
              </button>
            </ThemedPanel>
          </div>

          {(data?.duels.pending.length ?? 0) > 0 && (
            <SectionBlock title={t('compete.duelPending')} icon="hourglass_top" count={data!.duels.pending.length}>
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
            </SectionBlock>
          )}

          {(data?.duels.active.length ?? 0) > 0 && (
            <SectionBlock title={t('compete.duelActive')} icon="person_2" count={data!.duels.active.length}>
              {data!.duels.active.map((d) => (
                <DuelCard key={d.id} duel={d} busy={busy} />
              ))}
            </SectionBlock>
          )}

          {(data?.squads.recruiting.length ?? 0) + joinableSquads.length > 0 && (
            <SectionBlock
              title={t('compete.squadRecruiting')}
              icon="group_add"
              count={(data!.squads.recruiting.length ?? 0) + joinableSquads.length}
            >
              {data!.squads.recruiting.map((s) => (
                <SquadCard
                  key={s.id}
                  squad={s}
                  busy={busy}
                  viewerId={viewerId}
                  onStart={(id) => run(id, () => gamificationService.startSquad(id))}
                  onLeave={(id) => run(id, () => gamificationService.leaveSquad(id))}
                />
              ))}
              {joinableSquads.map((s) => (
                <SquadCard
                  key={s.id}
                  squad={s}
                  busy={busy}
                  viewerId={viewerId}
                  onJoin={(id) => run(id, () => gamificationService.joinSquad(id))}
                  onLeave={(id) => run(id, () => gamificationService.leaveSquad(id))}
                />
              ))}
            </SectionBlock>
          )}

          {(data?.squads.active.length ?? 0) > 0 && (
            <SectionBlock title={t('compete.squadActive')} icon="groups" count={data!.squads.active.length}>
              {data!.squads.active.map((s) => (
                <SquadCard key={s.id} squad={s} busy={busy} viewerId={viewerId} />
              ))}
            </SectionBlock>
          )}

          {!hasActivity && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/80 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <span className="material-symbols-outlined text-4xl text-gray-400">groups</span>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('compete.socialEmpty')}</p>
            </div>
          )}
        </div>
      )}
    </CompetePageShell>
  );
};
