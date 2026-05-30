import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { localeTag } from './dashboardLocale';
import {
  clampSleepHandle,
  clientPointToSleepMinutes,
  formatClockMinutes,
  pointOnSleepDial,
  resolveSleepWindow,
  saveSleepWindowOverride,
  sleepArcDegrees,
  sleepHoursBetween,
} from './wellnessWidgets';

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

const CX = 100;
const CY = 100;
const R = 72;
const HANDLE_VISUAL_R = 13;
const HANDLE_HIT_R = 22;
const SNAP_MINUTES = 5;

function describeArc(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(startDeg + sweepDeg));
  const y2 = cy + r * Math.sin(rad(startDeg + sweepDeg));
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

type DragHandle = 'bed' | 'wake';

export function SleepRhythmCard({
  sleepPreference,
  userId,
}: {
  sleepPreference?: string | null;
  userId?: string;
}) {
  const { t, language } = useI18n();
  const locale = localeTag(language);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragHandle | null>(null);

  const defaultWindow = useMemo(
    () => resolveSleepWindow(sleepPreference, userId),
    [sleepPreference, userId]
  );

  const [bedMinutes, setBedMinutes] = useState(defaultWindow.bedMinutes);
  const [wakeMinutes, setWakeMinutes] = useState(defaultWindow.wakeMinutes);
  const [dragging, setDragging] = useState<DragHandle | null>(null);
  const timesRef = useRef({ bed: defaultWindow.bedMinutes, wake: defaultWindow.wakeMinutes });

  useEffect(() => {
    const w = resolveSleepWindow(sleepPreference, userId);
    setBedMinutes(w.bedMinutes);
    setWakeMinutes(w.wakeMinutes);
    timesRef.current = { bed: w.bedMinutes, wake: w.wakeMinutes };
    setDragging(null);
  }, [sleepPreference, userId]);

  useEffect(() => {
    timesRef.current = { bed: bedMinutes, wake: wakeMinutes };
  }, [bedMinutes, wakeMinutes]);

  const arc = useMemo(() => sleepArcDegrees(bedMinutes, wakeMinutes), [bedMinutes, wakeMinutes]);
  const bedPoint = useMemo(() => pointOnSleepDial(CX, CY, R, bedMinutes), [bedMinutes]);
  const wakePoint = useMemo(() => pointOnSleepDial(CX, CY, R, wakeMinutes), [wakeMinutes]);
  const hours = sleepHoursBetween(bedMinutes, wakeMinutes);
  const hoursLabel = hours % 1 === 0 ? String(Math.round(hours)) : String(hours);
  const bedLabel = formatClockMinutes(bedMinutes, locale);
  const wakeLabel = formatClockMinutes(wakeMinutes, locale);

  const persistWindow = useCallback(
    (bed: number, wake: number) => {
      saveSleepWindowOverride(userId, bed, wake);
    },
    [userId]
  );

  const applyDragMinutes = useCallback(
    (handle: DragHandle, minutes: number) => {
      if (handle === 'bed') {
        const next = clampSleepHandle('bed', minutes, wakeMinutes);
        timesRef.current = { bed: next.bedMinutes, wake: next.wakeMinutes };
        setBedMinutes(next.bedMinutes);
        setWakeMinutes(next.wakeMinutes);
      } else {
        const next = clampSleepHandle('wake', bedMinutes, minutes);
        timesRef.current = { bed: next.bedMinutes, wake: next.wakeMinutes };
        setBedMinutes(next.bedMinutes);
        setWakeMinutes(next.wakeMinutes);
      }
    },
    [bedMinutes, wakeMinutes]
  );

  const pickHandle = useCallback(
    (clientX: number, clientY: number): DragHandle | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const vw = vb.width || 200;
      const vh = vb.height || 200;
      const px = ((clientX - rect.left) / rect.width) * vw;
      const py = ((clientY - rect.top) / rect.height) * vh;
      const dBed = Math.hypot(px - bedPoint.x, py - bedPoint.y);
      const dWake = Math.hypot(px - wakePoint.x, py - wakePoint.y);
      if (dBed <= HANDLE_HIT_R || dWake <= HANDLE_HIT_R) {
        return dBed <= dWake ? 'bed' : 'wake';
      }
      return null;
    },
    [bedPoint, wakePoint]
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const handle = pickHandle(e.clientX, e.clientY);
    if (!handle) return;
    e.preventDefault();
    dragRef.current = handle;
    setDragging(handle);
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const svg = svgRef.current;
    if (svg) {
      const minutes = clientPointToSleepMinutes(svg, e.clientX, e.clientY, CX, CY, SNAP_MINUTES);
      applyDragMinutes(handle, minutes);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const handle = dragRef.current;
    if (!handle) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const minutes = clientPointToSleepMinutes(svg, e.clientX, e.clientY, CX, CY, SNAP_MINUTES);
    applyDragMinutes(handle, minutes);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const handle = dragRef.current;
    if (!handle) return;
    dragRef.current = null;
    setDragging(null);
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    persistWindow(timesRef.current.bed, timesRef.current.wake);
  };

  const renderHandle = (handle: DragHandle, point: { x: number; y: number }) => {
    const active = dragging === handle;
    return (
      <g
        className="cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        aria-label={handle === 'bed' ? t('dashboard.bedtimeLabel') : t('dashboard.wakeTimeLabel')}
      >
        {active && (
          <circle
            cx={point.x}
            cy={point.y}
            r={HANDLE_VISUAL_R + 10}
            fill="#7c8ee4"
            opacity={0.35}
            className="animate-pulse"
          />
        )}
        <circle
          cx={point.x}
          cy={point.y}
          r={HANDLE_VISUAL_R + (active ? 4 : 0)}
          fill={active ? '#a5b4fc' : '#7c8ee4'}
          stroke="#fff"
          strokeWidth={active ? 3 : 2.5}
          style={{
            filter: active
              ? 'drop-shadow(0 0 8px rgba(124, 142, 228, 0.9)) drop-shadow(0 0 16px rgba(124, 142, 228, 0.5))'
              : 'drop-shadow(0 0 4px rgba(124, 142, 228, 0.45))',
            transition: dragging ? 'none' : 'r 0.2s ease, fill 0.2s ease',
          }}
        />
        <circle cx={point.x} cy={point.y} r={4} fill="#fff" className="pointer-events-none" />
      </g>
    );
  };

  return (
    <div className={cn(CARD, 'overflow-hidden px-4 py-4 sm:px-5 sm:py-5')}>
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {t('dashboard.sleepRhythmTitle')}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('dashboard.sleepRhythmDragHint')}</p>
      </div>

      <div className="relative mx-auto w-full max-w-[240px]">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className="w-full touch-none select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-label={t('dashboard.sleepRhythmTitle')}
        >
          <defs>
            <linearGradient id="sleep-arc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b9cf5" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-gray-200/90 dark:text-gray-700/80"
          />

          {[0, 6, 12, 18].map((h) => {
            const pt = pointOnSleepDial(CX, CY, R + 14, h * 60);
            return (
              <text
                key={h}
                x={pt.x}
                y={pt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-gray-500 text-[11px] font-semibold dark:fill-gray-400"
              >
                {h}
              </text>
            );
          })}

          <path
            d={describeArc(CX, CY, R, arc.start, arc.sweep)}
            fill="none"
            stroke="url(#sleep-arc-gradient)"
            strokeWidth={dragging ? 16 : 14}
            strokeLinecap="round"
            style={{
              transition: dragging ? 'none' : 'stroke-width 0.25s ease, d 0.15s ease',
              filter: dragging ? 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.55))' : undefined,
            }}
          />

          {renderHandle('bed', bedPoint)}
          {renderHandle('wake', wakePoint)}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <div
            className={cn(
              'flex items-center gap-1.5 text-sm font-bold transition-colors',
              dragging === 'bed' ? 'text-indigo-400' : 'text-gray-900 dark:text-white'
            )}
          >
            <span className="material-symbols-outlined text-base text-indigo-500">bedtime</span>
            {bedLabel}
          </div>
          <div
            className={cn(
              'mt-1 flex items-center gap-1.5 text-sm font-bold transition-colors',
              dragging === 'wake' ? 'text-indigo-400' : 'text-gray-900 dark:text-white'
            )}
          >
            <span className="material-symbols-outlined text-base text-indigo-500">alarm</span>
            {wakeLabel}
          </div>
        </div>
      </div>

      <p
        className={cn(
          'mt-3 text-center text-sm font-bold transition-colors',
          dragging ? 'text-indigo-400' : 'text-indigo-600 dark:text-indigo-400'
        )}
      >
        {t('dashboard.sleepTimeLabel', { hours: hoursLabel })}
      </p>

      <div className="mt-2 flex justify-center gap-4 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#7c8ee4] ring-2 ring-white dark:ring-gray-800" />
          {t('dashboard.bedtimeLabel')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#7c8ee4] ring-2 ring-white dark:ring-gray-800" />
          {t('dashboard.wakeTimeLabel')}
        </span>
      </div>
    </div>
  );
}
