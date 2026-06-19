export interface AnalysisStats {
  correct: number;
  incorrect: number;
  offsetAngle: number | null;
  cameraAligned: boolean;
  feedback: string[];
}

export function SquatStatsBar({ stats }: { stats: AnalysisStats }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 text-sm font-black text-emerald-400">
        <span className="material-symbols-outlined text-base">check_circle</span>
        {stats.correct}
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-2 text-sm font-black text-red-400">
        <span className="material-symbols-outlined text-base">cancel</span>
        {stats.incorrect}
      </span>
      {!stats.cameraAligned && stats.offsetAngle != null && (
        <span className="text-xs font-bold text-amber-400">
          Offset: {stats.offsetAngle}°
        </span>
      )}
    </div>
  );
}

export function SquatFeedbackList({ stats }: { stats: AnalysisStats }) {
  if (stats.feedback.length === 0) return null;
  return (
    <ul className="space-y-2">
      {stats.feedback.map((msg) => (
        <li
          key={msg}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200"
        >
          {msg}
        </li>
      ))}
    </ul>
  );
}
