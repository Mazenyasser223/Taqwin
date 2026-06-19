import React from 'react';
import { motion } from 'framer-motion';
import type { LandingShowcaseMockup } from './landingContent';
import { useI18n } from '../../lib/i18n/useI18n';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { LandingMuscleWikiPreview } from './LandingMuscleWikiPreview';
import { LandingCapHemaEyePreview } from './LandingCapHemaEyePreview';

type MockupProps = { className?: string };

const mockTitle = 'text-sm sm:text-base font-bold text-white';
const mockSubtitle = 'text-xs sm:text-sm font-semibold text-slate-300';
const mockLabel = 'text-[11px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wide';
const mockBody = 'text-xs sm:text-sm text-slate-100 leading-relaxed';
const mockMuted = 'text-[11px] sm:text-xs text-slate-300';
const mockCard = 'rounded-xl bg-slate-800/80 border border-slate-600/50';

function MockupFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl sm:rounded-3xl border border-slate-600/60 bg-[#0f1c24] overflow-hidden shadow-2xl shadow-black/50 ${className}`}
    >
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-600/50 bg-[#0a141c]">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ms-auto text-[11px] font-semibold text-slate-400">Taqwin</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

/** Compact AI chat screen for the hero phone mockup (no browser chrome). */
export function HeroPhoneChat() {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a141c] text-white">
      <div className="shrink-0 flex items-center gap-2.5 px-4 pt-10 pb-3 border-b border-white/10 bg-[#0a141c]/95">
        <div className="size-9 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">smart_toy</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{t('landing.mockAiCoachName')}</p>
          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('landing.mockOnline')}
          </p>
        </div>
        <span className="material-symbols-outlined text-slate-400 text-xl">more_vert</span>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-end"
        >
          <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[11px] sm:text-xs leading-relaxed font-medium">
            {t('landing.mockAiCoachUser')}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="flex gap-2"
        >
          <div className="size-7 rounded-full bg-primary/25 shrink-0 flex items-center justify-center mt-0.5">
            <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
          </div>
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-slate-800/90 border border-slate-600/50 px-3 py-2 text-[11px] sm:text-xs leading-relaxed text-slate-100">
            {t('landing.mockAiCoachBot')}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="flex gap-1.5 flex-wrap ps-9"
        >
          {[t('landing.mockAiChip1'), t('landing.mockAiChip2')].map((chip) => (
            <span
              key={chip}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary/40 bg-primary/15 text-primary"
            >
              {chip}
            </span>
          ))}
        </motion.div>
      </div>

      <div className="shrink-0 px-3 pb-4 pt-2 border-t border-white/10 bg-[#0a141c]">
        <div className="flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-600/50 px-3 py-2.5">
          <span className="material-symbols-outlined text-slate-400 text-lg">add_circle</span>
          <span className="flex-1 text-[11px] text-slate-500 font-medium">{t('landing.featureHeroChatPlaceholder')}</span>
          <span className="material-symbols-outlined text-primary text-lg">send</span>
        </div>
      </div>
    </div>
  );
}

function AiCoachMockup({ className }: MockupProps) {
  const { t } = useI18n();
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-600/50">
          <div className="size-10 rounded-full bg-primary/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
          </div>
          <div>
            <p className={mockTitle}>{t('landing.mockAiCoachName')}</p>
            <p className="text-xs font-semibold text-emerald-400">{t('landing.mockOnline')}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className={`max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 ${mockBody} text-white`}>
            {t('landing.mockAiCoachUser')}
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="size-8 rounded-full bg-primary/25 shrink-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
          </div>
          <div className={`max-w-[90%] rounded-2xl rounded-bl-md ${mockCard} px-4 py-2.5 ${mockBody}`}>
            {t('landing.mockAiCoachBot')}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap pt-1">
          {[t('landing.mockAiChip1'), t('landing.mockAiChip2'), t('landing.mockAiChip3')].map((chip) => (
            <span
              key={chip}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function NutritionMockup({ className }: MockupProps) {
  const { t } = useI18n();
  const foods = [
    { name: t('landing.mockFood1'), cal: '320', p: '28g', img: '/nutrition/categories/poultry.jfif' },
    { name: t('landing.mockFood2'), cal: '180', p: '6g', img: '/nutrition/categories/grains-pasta.jfif' },
    { name: t('landing.mockFood3'), cal: '95', p: '4g', img: '/nutrition/categories/fruits-juices.jfif' },
  ];
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className={mockTitle}>{t('landing.mockNutritionTitle')}</p>
          <span className="text-xs text-emerald-400 font-bold">{t('landing.mockToday')}</span>
        </div>
        <div className={`grid grid-cols-3 gap-2 text-center rounded-xl p-3 ${mockCard}`}>
          {[
            { label: t('landing.mockCalories'), val: '1,840', color: 'text-amber-300' },
            { label: t('landing.mockProtein'), val: '142g', color: 'text-rose-300' },
            { label: t('landing.mockCarbs'), val: '198g', color: 'text-sky-300' },
          ].map((m) => (
            <div key={m.label}>
              <p className={`text-lg font-black ${m.color}`}>{m.val}</p>
              <p className={mockLabel}>{m.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {foods.map((food) => (
            <div key={food.name} className={`flex items-center gap-3 p-2.5 ${mockCard}`}>
              <div
                className="size-11 rounded-lg bg-cover bg-center shrink-0 border border-slate-600/50"
                style={{ backgroundImage: `url(${food.img})` }}
              />
              <div className="flex-1 min-w-0">
                <p className={`${mockBody} font-bold truncate`}>{food.name}</p>
                <p className={mockMuted}>
                  {food.cal} kcal · {food.p} {t('landing.mockProteinShort')}
                </p>
              </div>
              <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function WorkoutsMockup({ className }: MockupProps) {
  const { t } = useI18n();
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className={mockTitle}>{t('landing.mockWorkoutsTitle')}</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-400/20 text-sky-300 font-bold">
            {t('landing.mockMuscleWiki')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              name: t('landing.mockExercise1'),
              muscle: t('landing.mockMuscleChest'),
              thumb: '/workouts/categories/chest.jpg',
            },
            {
              name: t('landing.mockExercise2'),
              muscle: t('landing.mockMuscleBack'),
              thumb: '/workouts/categories/back.jpg',
            },
          ].map((ex) => (
            <div key={ex.name} className={`overflow-hidden ${mockCard}`}>
              <div className="relative h-24 sm:h-28 overflow-hidden">
                <img
                  src={ex.thumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center scale-105"
                  loading="lazy"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-4xl drop-shadow-lg">play_circle</span>
                </div>
                <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/70 px-1.5 py-0.5 rounded text-white font-bold border border-white/15">
                  HD
                </span>
              </div>
              <div className="p-2.5">
                <p className={`${mockBody} font-bold leading-tight`}>{ex.name}</p>
                <p className="text-xs text-sky-300 mt-1 font-semibold">{ex.muscle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function MuscleWikiMockup({ className }: MockupProps) {
  return <LandingMuscleWikiPreview className={className} />;
}

function CapHemaEyeMockup({ className }: MockupProps) {
  const { t } = useI18n();

  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className={mockTitle}>{t('landing.mockCapHemaEyeTitle')}</p>
            <p className={`${mockMuted} mt-0.5`}>{t('landing.mockCapHemaEyeSubtitle')}</p>
          </div>
          <span className="shrink-0 text-xs font-black px-2.5 py-1 rounded-full bg-[#7CFC00]/15 text-[#ADFF2F] border border-[#7CFC00]/35">
            {t('landing.mockCapHemaEyeLive')}
          </span>
        </div>

        <LandingCapHemaEyePreview />

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-sm font-black text-emerald-300">
            <span className="material-symbols-outlined text-base">check_circle</span>
            12
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-1.5 text-sm font-black text-red-300">
            <span className="material-symbols-outlined text-base">cancel</span>
            2
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#7CFC00]/10 border border-[#7CFC00]/25 px-3 py-1.5 text-xs font-bold text-[#ADFF2F]">
            {t('landing.mockCapHemaEyeReps')}
          </span>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <p className={`${mockBody} text-amber-100 font-semibold`}>{t('landing.mockCapHemaEyeFeedback')}</p>
        </div>
      </div>
    </MockupFrame>
  );
}

function DashboardMockup({ className }: MockupProps) {
  const { t } = useI18n();
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className={mockTitle}>{t('landing.mockDashboardTitle')}</p>
            <p className="text-xs text-violet-300 font-semibold mt-0.5">{t('landing.mockAthleteDashboard')}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-violet-400/20 text-violet-200 font-bold">
            {t('landing.mockToday')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: t('landing.mockStreak'), val: '12', icon: 'local_fire_department', color: 'text-orange-300' },
            { label: t('landing.mockReadiness'), val: '87%', icon: 'favorite', color: 'text-rose-300' },
            { label: t('landing.mockFitnessScore'), val: '74', icon: 'bolt', color: 'text-amber-300' },
            { label: t('landing.mockWeekProgress'), val: '5/7', icon: 'calendar_today', color: 'text-sky-300' },
          ].map((kpi) => (
            <div key={kpi.label} className={`p-3 ${mockCard}`}>
              <span className={`material-symbols-outlined text-xl ${kpi.color}`}>{kpi.icon}</span>
              <p className="text-2xl font-black text-white leading-none mt-1.5">{kpi.val}</p>
              <p className={`${mockLabel} mt-1`}>{kpi.label}</p>
            </div>
          ))}
        </div>
        <div className={`p-3.5 space-y-2.5 ${mockCard}`}>
          <div className="flex justify-between items-center">
            <p className={mockSubtitle}>{t('landing.mockTodayWorkout')}</p>
            <span className="text-xs text-violet-300 font-bold">45 min</span>
          </div>
          {[
            t('landing.mockWorkoutItem1'),
            t('landing.mockWorkoutItem2'),
            t('landing.mockWorkoutItem3'),
          ].map((item, i) => (
            <div key={item} className="flex items-center gap-2.5">
              <span
                className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-200'
                }`}
              >
                {i === 0 ? '✓' : i + 1}
              </span>
              <p className={`text-sm ${i === 0 ? 'text-slate-400 line-through' : 'text-slate-100 font-medium'}`}>
                {item}
              </p>
            </div>
          ))}
        </div>
        <div className="h-16 rounded-xl bg-slate-800/80 border border-violet-400/30 flex items-end px-3 pb-2 gap-1.5">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-violet-400/80" style={{ height: `${h * 0.4}%` }} />
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function leagueAvatarUrl(seed: string) {
  return `https://api.dicebear.com/7.x/personas/png?seed=${encodeURIComponent(seed)}&size=64&backgroundColor=0d9488,0891b2,7c3aed,f59e0b`;
}

function LeagueMockup({ className }: MockupProps) {
  const { t } = useI18n();
  const leaderboard = [
    { name: t('landing.mockLeagueUser1'), score: '82', rank: 1, seed: 'taqwin-sara-m' },
    { name: t('landing.mockLeagueUser2'), score: '78', rank: 2, seed: 'taqwin-omar-h' },
    { name: t('landing.mockLeagueYou'), score: '74', rank: 3, seed: 'taqwin-you', you: true },
    { name: t('landing.mockLeagueUser3'), score: '71', rank: 4, seed: 'taqwin-nour-a' },
  ];
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className={mockTitle}>{t('landing.mockLeagueTitle')}</p>
            <p className={mockMuted}>{t('landing.mockLeagueSubtitle')}</p>
          </div>
          <span className="shrink-0 text-xs font-black px-2.5 py-1 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
            {t('compete.tier.gold')}
          </span>
        </div>
        <div className={`grid grid-cols-2 gap-2.5 ${mockCard} p-3`}>
          <div>
            <p className="text-2xl font-black text-yellow-300">#3</p>
            <p className={mockLabel}>{t('landing.mockLeagueRank')}</p>
          </div>
          <div>
            <p className="text-2xl font-black text-white">74</p>
            <p className={mockLabel}>{t('landing.mockLeagueWeeklyAvg')}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className={mockSubtitle}>{t('landing.mockLeagueBoard')}</p>
          {leaderboard.map((row) => (
            <div
              key={row.name}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl ${
                row.you ? 'bg-yellow-400/15 border border-yellow-400/35' : mockCard
              }`}
            >
              <span className="text-sm font-black text-slate-300 w-5">#{row.rank}</span>
              <UserAvatar
                avatarUrl={leagueAvatarUrl(row.seed)}
                displayName={row.name}
                className="size-9 rounded-full shrink-0 ring-2 ring-slate-600/80"
                imgClassName="size-9 rounded-full object-cover shrink-0 ring-2 ring-slate-600/80"
                alt={row.name}
              />
              <span className={`flex-1 text-sm font-semibold ${row.you ? 'text-yellow-200' : 'text-slate-100'}`}>
                {row.name}
              </span>
              <span className="text-sm font-black text-white tabular-nums">{row.score}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function CompeteMockup({ className }: MockupProps) {
  const { t } = useI18n();
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className={mockTitle}>{t('landing.mockCompeteTitle')}</p>
            <p className={mockMuted}>{t('landing.mockCompeteSubtitle')}</p>
          </div>
          <span className="material-symbols-outlined text-orange-300 text-2xl">flag</span>
        </div>
        <div className={`p-4 space-y-3 ${mockCard} border-orange-400/30`}>
          <div className="flex justify-between items-start gap-2">
            <p className={`${mockSubtitle} text-orange-200`}>{t('compete.challenge.workout-7.title')}</p>
            <span className="text-xs font-bold text-orange-300 shrink-0">+120 XP</span>
          </div>
          <p className={mockMuted}>{t('compete.challenge.workout-7.desc')}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-2.5 rounded-lg bg-slate-900/60`}>
              <p className="text-xl font-black text-white">
                3<span className="text-base text-slate-400">/4</span>
              </p>
              <p className={mockLabel}>{t('compete.progressLabel')}</p>
            </div>
            <div className={`p-2.5 rounded-lg bg-slate-900/60`}>
              <p className="text-xl font-black text-white">4</p>
              <p className={mockLabel}>{t('compete.daysLeft')}</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span>{t('compete.progressLabel')}</span>
              <span className="text-orange-300">75%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-orange-400 to-amber-300" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { title: t('compete.challenge.hydration-7.title'), xp: '80' },
            { title: t('compete.challenge.streak-7.title'), xp: '100' },
          ].map((c) => (
            <div key={c.title} className={`p-3 ${mockCard}`}>
              <p className="text-xs font-bold text-slate-100 leading-snug line-clamp-2">{c.title}</p>
              <p className="text-xs text-orange-300 font-bold mt-2">+{c.xp} XP</p>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function CommunityMockupBody({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const stories = [
    { seed: 'taqwin-story-sara', name: t('landing.mockStoryUser1'), active: true },
    { seed: 'taqwin-story-omar', name: t('landing.mockStoryUser2'), active: false },
    { seed: 'taqwin-story-nour', name: t('landing.mockStoryUser3'), active: false },
  ];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
        {stories.map((story) => (
          <div key={story.seed} className="shrink-0 flex flex-col items-center gap-1 min-w-[3rem] sm:min-w-[3.5rem]">
            <div
              className={`${compact ? 'size-10' : 'size-12'} rounded-full p-0.5 ${
                story.active ? 'bg-gradient-to-tr from-rose-400 to-primary' : 'bg-slate-600'
              }`}
            >
              <UserAvatar
                avatarUrl={leagueAvatarUrl(story.seed)}
                displayName={story.name}
                className="size-full rounded-full bg-slate-800 text-[10px]"
                imgClassName="size-full rounded-full object-cover"
                alt={story.name}
              />
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-300 font-medium truncate max-w-[3rem] sm:max-w-[3.5rem]">
              {story.name}
            </span>
          </div>
        ))}
      </div>
      <div className={`${compact ? 'p-2.5' : 'p-3.5'} space-y-2.5 sm:space-y-3 ${mockCard}`}>
        <div className="flex items-center gap-2">
          <UserAvatar
            avatarUrl={leagueAvatarUrl('taqwin-ahmed-k')}
            displayName={t('landing.mockCommunityUser')}
            className={`${compact ? 'size-8' : 'size-9'} rounded-full shrink-0 ring-2 ring-slate-600/80`}
            imgClassName={`${compact ? 'size-8' : 'size-9'} rounded-full object-cover shrink-0 ring-2 ring-slate-600/80`}
            alt={t('landing.mockCommunityUser')}
          />
          <div className="min-w-0">
            <p className={`${compact ? 'text-xs' : mockBody} font-bold truncate`}>{t('landing.mockCommunityUser')}</p>
            <p className={mockMuted}>{t('landing.mockCommunityTime')}</p>
          </div>
        </div>
        <p className={`${compact ? 'text-[11px] leading-snug' : mockBody} line-clamp-3`}>{t('landing.mockCommunityPost')}</p>
        <div
          className={`relative ${compact ? 'h-24' : 'h-32 sm:h-36'} rounded-lg overflow-hidden border border-slate-600/40`}
        >
          <img
            src="/workouts/categories/free-weights.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <span className="absolute bottom-1.5 left-1.5 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/55 text-white border border-white/10">
            {t('landing.mockCommunityPostTag')}
          </span>
        </div>
        <div className={`flex gap-4 ${compact ? 'text-xs' : 'text-sm'} text-slate-300 font-semibold`}>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base text-rose-400">favorite</span> 48
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">chat_bubble</span> 12
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">share</span> 5
          </span>
        </div>
      </div>
    </div>
  );
}

/** Phone-sized community feed — matches HeroPhoneChat shell styling. */
export function CommunityPhoneMockup() {
  const { t } = useI18n();
  const stories = [
    { seed: 'taqwin-story-sara', name: t('landing.mockStoryUser1'), active: true },
    { seed: 'taqwin-story-omar', name: t('landing.mockStoryUser2'), active: false },
    { seed: 'taqwin-story-nour', name: t('landing.mockStoryUser3'), active: false },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a141c] text-white">
      <div className="shrink-0 flex items-center gap-2.5 px-4 pt-10 pb-3 border-b border-white/10 bg-[#0a141c]/95">
        <div className="size-9 rounded-full bg-rose-500/25 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-rose-400 text-lg">groups</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{t('landing.showcaseCommunityTitle')}</p>
          <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('landing.mockCommunityLive')}
          </p>
        </div>
        <span className="material-symbols-outlined text-slate-400 text-xl">more_vert</span>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 space-y-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-2.5 overflow-x-auto pb-0.5 scrollbar-none"
        >
          {stories.map((story) => (
            <div key={story.seed} className="shrink-0 flex flex-col items-center gap-1 min-w-[2.75rem]">
              <div
                className={`size-10 rounded-full p-0.5 ${
                  story.active ? 'bg-gradient-to-tr from-rose-400 to-primary' : 'bg-slate-600'
                }`}
              >
                <UserAvatar
                  avatarUrl={leagueAvatarUrl(story.seed)}
                  displayName={story.name}
                  className="size-full rounded-full bg-slate-800 text-[10px]"
                  imgClassName="size-full rounded-full object-cover"
                  alt={story.name}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-medium truncate max-w-[2.75rem]">{story.name}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl rounded-bl-md bg-slate-800/90 border border-slate-600/50 p-3 space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <UserAvatar
              avatarUrl={leagueAvatarUrl('taqwin-ahmed-k')}
              displayName={t('landing.mockCommunityUser')}
              className="size-8 rounded-full shrink-0 ring-2 ring-slate-600/80"
              imgClassName="size-8 rounded-full object-cover shrink-0 ring-2 ring-slate-600/80"
              alt={t('landing.mockCommunityUser')}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{t('landing.mockCommunityUser')}</p>
              <p className="text-[10px] text-slate-400">{t('landing.mockCommunityTime')}</p>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-100">{t('landing.mockCommunityPost')}</p>
          <div className="relative h-24 rounded-xl overflow-hidden border border-slate-600/40">
            <img
              src="/workouts/categories/free-weights.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/55 text-white border border-white/10">
              {t('landing.mockCommunityPostTag')}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[t('landing.mockCommunityChip1'), t('landing.mockCommunityChip2')].map((chip) => (
              <span
                key={chip}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-300"
              >
                {chip}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="shrink-0 px-3 pb-4 pt-2 border-t border-white/10 bg-[#0a141c]">
        <div className="flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-600/50 px-3 py-2.5">
          <span className="material-symbols-outlined text-slate-400 text-lg">add_circle</span>
          <span className="flex-1 text-[11px] text-slate-500 font-medium">{t('landing.mockCommunityCompose')}</span>
          <span className="material-symbols-outlined text-primary text-lg">send</span>
        </div>
      </div>
    </div>
  );
}

function CommunityMockup({ className }: MockupProps) {
  return (
    <MockupFrame className={className}>
      <CommunityMockupBody />
    </MockupFrame>
  );
}

function MarketplaceMockup({ className }: MockupProps) {
  const { t } = useI18n();
  /** Matches demo shop catalog (`shopCatalogSeed.js`) — local product photos. */
  const products = [
    {
      name: t('landing.mockProduct1'),
      brand: 'Taqwin Labs',
      price: '1,899',
      compareAt: '2,299',
      badge: t('landing.mockSale'),
      image: '/assets/landing/marketplace/whey-protein.jpg',
    },
    {
      name: t('landing.mockProduct2'),
      brand: 'Kaged',
      price: '699',
      compareAt: null,
      badge: null,
      image: '/assets/landing/marketplace/creatine.jpg',
    },
    {
      name: t('landing.mockProduct3'),
      brand: 'Taqwin Labs',
      price: '899',
      compareAt: '1,099',
      badge: t('landing.mockNew'),
      image: '/assets/landing/marketplace/pre-workout.jpg',
    },
    {
      name: t('landing.mockProduct4'),
      brand: 'IronMile',
      price: '599',
      compareAt: '749',
      badge: null,
      image: '/assets/landing/marketplace/resistance-bands.jpg',
    },
  ];
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className={mockTitle}>{t('landing.mockMarketplaceTitle')}</p>
          <span className="material-symbols-outlined text-amber-300 text-2xl">shopping_cart</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {products.map((p) => (
            <div key={p.name} className={`overflow-hidden ${mockCard}`}>
              <div className="relative h-24 sm:h-28 overflow-hidden bg-slate-900">
                <img
                  src={p.image}
                  alt={p.name}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="lazy"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                {p.badge ? (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400 text-black">
                    {p.badge}
                  </span>
                ) : null}
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{p.brand}</p>
                <p className={`${mockBody} font-bold leading-tight line-clamp-2`}>{p.name}</p>
                <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
                  <p className="text-sm font-black text-amber-300">
                    {p.price} {t('landing.mockEgp')}
                  </p>
                  {p.compareAt ? (
                    <p className="text-[11px] text-slate-500 line-through font-medium">
                      {p.compareAt} {t('landing.mockEgp')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function TrackingMockup({ className }: MockupProps) {
  const { t } = useI18n();
  const weightTrend = [78.4, 78.1, 77.9, 77.6, 77.2, 76.9, 76.6];
  const maxW = Math.max(...weightTrend);
  const minW = Math.min(...weightTrend);
  const range = maxW - minW || 1;

  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className={mockTitle}>{t('landing.mockTrackingTitle')}</p>
            <p className="text-xs text-indigo-300 font-semibold mt-0.5">{t('landing.mockTrackingSubtitle')}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-400/20 text-indigo-200 font-bold">
            {t('landing.mockToday')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: t('landing.mockTrackingWeight'), val: '76.6 kg', delta: '-0.8', icon: 'monitor_weight', color: 'text-indigo-300' },
            { label: t('landing.mockBodyScore'), val: '74', delta: '+3', icon: 'favorite', color: 'text-rose-300' },
            { label: t('landing.mockTrackingCalories'), val: '82%', delta: t('landing.mockTrackingOnTarget'), icon: 'local_fire_department', color: 'text-orange-300' },
            { label: t('landing.mockTrackingWorkouts'), val: '5/7', delta: t('landing.mockWeekProgress'), icon: 'fitness_center', color: 'text-emerald-300' },
          ].map((kpi) => (
            <div key={kpi.label} className={`p-3 ${mockCard}`}>
              <span className={`material-symbols-outlined text-lg ${kpi.color}`}>{kpi.icon}</span>
              <p className="text-xl font-black text-white leading-none mt-1.5">{kpi.val}</p>
              <p className={`${mockLabel} mt-1`}>{kpi.label}</p>
              <p className="text-[11px] text-indigo-300 font-bold mt-0.5">{kpi.delta}</p>
            </div>
          ))}
        </div>

        <div className={`p-3.5 space-y-3 ${mockCard}`}>
          <div className="flex justify-between items-center">
            <p className={mockSubtitle}>{t('landing.mockTrackingWeightTrend')}</p>
            <span className="text-xs text-emerald-300 font-bold">{t('landing.mockTrackingWeightDelta')}</span>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {weightTrend.map((w, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-indigo-500/90 to-indigo-300/80"
                style={{ height: `${((w - minW) / range) * 70 + 30}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>{t('landing.mockTrackingWeekStart')}</span>
            <span>{t('landing.mockToday')}</span>
          </div>
        </div>

        <div className={`p-3.5 space-y-2.5 ${mockCard}`}>
          <p className={mockSubtitle}>{t('landing.mockTrackingMacros')}</p>
          {[
            { label: t('landing.mockProtein'), pct: 91, color: 'bg-emerald-400' },
            { label: t('landing.mockCarbs'), pct: 76, color: 'bg-amber-400' },
            { label: t('landing.mockCalories'), pct: 82, color: 'bg-orange-400' },
          ].map((macro) => (
            <div key={macro.label} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-200">
                <span>{macro.label}</span>
                <span className="text-indigo-200">{macro.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                <div className={`h-full rounded-full ${macro.color}`} style={{ width: `${macro.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

function TelegramMockupBody() {
  const { t } = useI18n();
  const messages = [
    { title: t('landing.mockTelegramMsg1Title'), body: t('landing.mockTelegramMsg1Body'), time: '09:00', icon: 'fitness_center' },
    { title: t('landing.mockTelegramMsg2Title'), body: t('landing.mockTelegramMsg2Body'), time: '14:22', icon: 'emoji_events' },
    { title: t('landing.mockTelegramMsg3Title'), body: t('landing.mockTelegramMsg3Body'), time: '07:30', icon: 'wb_sunny' },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0e1621] text-white">
      <div className="shrink-0 flex items-center gap-2.5 px-3 pt-10 pb-3 bg-[#17212b] border-b border-white/5">
        <div className="size-9 rounded-full bg-sky-500/30 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-sky-400 text-lg">smart_toy</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{t('landing.mockTelegramBotName')}</p>
          <p className="text-[11px] font-semibold text-sky-300">{t('landing.mockTelegramBotStatus')}</p>
        </div>
        <span className="material-symbols-outlined text-slate-400 text-lg">more_vert</span>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 space-y-3">
        {messages.map((msg, i) => (
          <motion.div
            key={msg.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="max-w-[92%] rounded-2xl rounded-bl-md bg-[#182533] border border-sky-500/20 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-sky-400 text-sm">{msg.icon}</span>
              <p className="text-[11px] font-bold text-sky-300">{msg.title}</p>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-100">{msg.body}</p>
            <p className="text-[10px] text-slate-500 mt-1.5 text-end">{msg.time}</p>
          </motion.div>
        ))}
      </div>

      <div className="shrink-0 px-3 pb-4 pt-2 border-t border-white/5 bg-[#17212b]">
        <div className="flex items-center gap-2 rounded-full bg-[#242f3d] border border-white/5 px-3 py-2">
          <span className="material-symbols-outlined text-slate-500 text-lg">attach_file</span>
          <span className="flex-1 text-[11px] text-slate-500">{t('landing.mockTelegramCompose')}</span>
          <span className="material-symbols-outlined text-sky-400 text-lg">send</span>
        </div>
      </div>
    </div>
  );
}

export function TelegramPhoneMockup() {
  return <TelegramMockupBody />;
}

function TelegramMockup({ className }: MockupProps) {
  return (
    <MockupFrame className={className}>
      <div className="relative h-72 sm:h-80 rounded-xl overflow-hidden border border-sky-500/20">
        <TelegramMockupBody />
      </div>
    </MockupFrame>
  );
}

function GymOwnerMockup({ className }: MockupProps) {
  const { t } = useI18n();
  return (
    <MockupFrame className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className={mockTitle}>{t('landing.mockGymTitle')}</p>
            <p className="text-xs text-cyan-300 font-semibold mt-0.5">{t('landing.mockGymOwnerDashboard')}</p>
          </div>
          <span className="text-xs text-cyan-300 font-bold px-2.5 py-1 rounded-full bg-cyan-400/15">
            {t('landing.mockGymLive')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: t('landing.mockGymMembers'), val: '248', sub: '+12' },
            { label: t('landing.mockGymPresent'), val: '34', sub: '68%' },
            { label: t('landing.mockGymCheckins'), val: '1.2K', sub: t('landing.mockGymWeek') },
            { label: t('landing.mockGymRevenue'), val: '84K', sub: t('landing.mockEgp') },
          ].map((kpi) => (
            <div key={kpi.label} className={`p-3 ${mockCard}`}>
              <p className="text-xl font-black text-white leading-none">{kpi.val}</p>
              <p className={`${mockLabel} mt-1.5`}>{kpi.label}</p>
              <p className="text-xs text-cyan-300 font-bold mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
        <div className={`p-3 space-y-2 ${mockCard}`}>
          <p className={mockSubtitle}>{t('landing.mockGymSessions')}</p>
          {[
            { name: t('landing.mockGymClass1'), booked: '18/20' },
            { name: t('landing.mockGymClass2'), booked: '12/15' },
          ].map((c) => (
            <div key={c.name} className="flex justify-between items-center text-sm">
              <span className="text-slate-200 font-medium">{c.name}</span>
              <span className="text-cyan-300 font-bold">{c.booked}</span>
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

const MOCKUP_MAP: Record<LandingShowcaseMockup, React.FC<MockupProps>> = {
  ai: AiCoachMockup,
  nutrition: NutritionMockup,
  workouts: WorkoutsMockup,
  'muscle-wiki': MuscleWikiMockup,
  'cap-hema-eye': CapHemaEyeMockup,
  dashboard: DashboardMockup,
  tracking: TrackingMockup,
  telegram: TelegramMockup,
  league: LeagueMockup,
  compete: CompeteMockup,
  community: CommunityMockup,
  marketplace: MarketplaceMockup,
  gym: GymOwnerMockup,
};

export function LandingFeatureMockup({ type, className }: { type: LandingShowcaseMockup; className?: string }) {
  const Component = MOCKUP_MAP[type];
  return <Component className={className} />;
}
