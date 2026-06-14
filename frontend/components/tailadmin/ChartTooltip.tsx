import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/95 px-3.5 py-2.5 shadow-xl backdrop-blur-sm">
      {label && <p className="mb-1 text-theme-xs font-medium text-gray-400">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color ?? '#158b8d' }} />
          <span className="text-theme-sm font-semibold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};
