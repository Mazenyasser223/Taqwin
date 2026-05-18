import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  staggerContainer,
  buttonPress,
  weightedTransition,
  snapTransition,
  pulseTransition,
  useMotionPrefs,
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { NutritionVisual } from '../../3d/PageSpecificVisuals';
import nutritionService, { type DailyNutritionSummary } from '../../services/nutritionService';
import type { FoodItem } from '../../types';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=400';

const Counter: React.FC<{ value: number; duration?: number; className?: string }> = ({ value, duration = 2, className = '' }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const controls = animate(count, value, { duration, ease: 'easeOut' });
    const unsubscribe = rounded.on('change', (v) => setDisplayValue(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration]);
  return <span className={className}>{displayValue}</span>;
};

const DEFAULT_TARGET = 2200;

export const NutritionLibrary: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [logTarget, setLogTarget] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([nutritionService.getFoodItems(), nutritionService.getDailySummary()])
      .then(([foods, sum]) => {
        if (foods.error) setError(foods.error);
        else setItems(foods.data ?? []);
        if (sum.data) setSummary(sum.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const caloriesLeft = Math.max(0, DEFAULT_TARGET - (summary?.calories ?? 0));

  const submitLog = async () => {
    if (!logTarget) return;
    setLogSubmitting(true);
    const res = await nutritionService.logFood({ foodItemId: logTarget.id, grams });
    setLogSubmitting(false);
    if (res.error) {
      setToast(res.error);
    } else {
      setToast(`Logged ${grams}g of ${logTarget.name}`);
      setLogTarget(null);
      reload();
    }
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={weightedTransition} className="relative z-10">
          <div className="flex items-center gap-3 text-accent mb-3">
            <span className="material-symbols-outlined font-black">restaurant</span>
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Daily Food Plan</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight text-foreground leading-none">
            {t('nutrition.titleMain')} <span className="text-accent italic">{t('nutrition.titleAccent')}</span>
          </h1>
          <p className="text-muted mt-5 max-w-lg font-medium leading-relaxed">
            {t('nutrition.subtitleLong')}
          </p>
        </motion.div>

        <div className="flex gap-4 relative z-10">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-faint">search</span>
            <input
              type="text"
              placeholder={t('nutrition.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-elevated border border-subtle rounded-2xl pl-12 pr-6 py-4 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all font-bold placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="absolute -top-16 right-0 w-80 h-80 pointer-events-none opacity-40">
          <NutritionVisual />
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm">{toast}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-faint">{t('nutrition.foodList')}</h3>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {loading && <div className="text-accent animate-pulse">{t('nutrition.loading')}</div>}

          {!loading && filtered.length === 0 && (
            <div className="glass-panel p-10 rounded-3xl text-center text-muted">
              {t('nutrition.noFoods', { query: searchQuery })}
            </div>
          )}

          <motion.div layout variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, x: -20, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={snapTransition}
                  className="glass-panel p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 hover:border-accent/40 transition-all group"
                >
                  <div className="size-24 rounded-3xl overflow-hidden shadow-2xl border border-subtle flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                    <img src={item.imageUrl || FALLBACK_IMG} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 bg-accent/5 px-3 py-1 rounded-full border border-accent/10">
                      {item.category}
                    </span>
                    <h4 className="text-2xl font-black group-hover:text-accent transition-colors tracking-tight">{item.name}</h4>
                    <p className="text-xs text-faint">per 100g</p>
                  </div>
                  <div className="flex gap-4 items-center bg-elevated p-4 rounded-3xl border border-subtle group-hover:bg-elevated-hover transition-all">
                    {[
                      { label: 'Prot', val: item.protein, color: 'text-primary' },
                      { label: 'Carb', val: item.carbs, color: 'text-blue-400' },
                      { label: 'Fat', val: item.fat, color: 'text-accent' },
                    ].map((macro) => (
                      <div key={macro.label} className="text-center min-w-[75px] border-r last:border-0 border-subtle pr-4 last:pr-0">
                        <p className={`text-xl font-black ${macro.color}`}>
                          <Counter value={macro.val} duration={1.2} />g
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-tighter text-faint mt-1">{macro.label}</p>
                      </div>
                    ))}
                    <div className="pl-6 text-center">
                      <p className="text-xl font-black text-foreground">
                        <Counter value={item.calories} duration={1.5} />
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-tighter text-faint mt-1">CAL</p>
                    </div>
                    <button
                      onClick={() => {
                        setLogTarget(item);
                        setGrams(100);
                      }}
                      className="ml-2 size-12 rounded-xl bg-accent text-white font-black flex items-center justify-center hover:scale-110 transition-all"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <TiltCard maxTilt={3}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...weightedTransition, delay: 0.3 }}
              className="glass-panel p-12 rounded-[4rem] text-center space-y-10 relative overflow-hidden border-accent/20"
            >
              <div className="relative size-60 mx-auto">
                <div className="absolute inset-4 border-[14px] border-subtle border-t-accent rounded-full flex items-center justify-center shadow-2xl">
                  <div className="relative z-10">
                    <motion.div animate={!shouldSimplify ? pulseTransition : {}} className="text-5xl font-black tracking-tighter">
                      <Counter value={caloriesLeft} duration={2} />
                    </motion.div>
                    <p className="text-[10px] text-faint font-black uppercase tracking-[0.3em] mt-2">Calories Left</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-black uppercase tracking-[0.4em] text-accent">Today</h4>
                <div className="grid grid-cols-3 gap-3 text-xs font-bold">
                  <div>
                    <p className="text-foreground text-lg">{summary?.protein.toFixed(0) ?? 0}g</p>
                    <p className="text-faint">Protein</p>
                  </div>
                  <div>
                    <p className="text-foreground text-lg">{summary?.carbs.toFixed(0) ?? 0}g</p>
                    <p className="text-faint">Carbs</p>
                  </div>
                  <div>
                    <p className="text-foreground text-lg">{summary?.fat.toFixed(0) ?? 0}g</p>
                    <p className="text-faint">Fat</p>
                  </div>
                </div>
                <p className="text-xs text-faint">{summary?.logCount ?? 0} entries today</p>
              </div>
            </motion.div>
          </TiltCard>
        </div>
      </div>

      <AnimatePresence>
        {logTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setLogTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel w-full max-w-md rounded-3xl p-8 space-y-6"
            >
              <div className="flex items-center gap-4">
                <img src={logTarget.imageUrl || FALLBACK_IMG} className="size-16 rounded-2xl object-cover" alt={logTarget.name} />
                <div>
                  <h3 className="text-2xl font-black">{logTarget.name}</h3>
                  <p className="text-xs uppercase text-accent font-black tracking-widest">{logTarget.category}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-faint font-black">Grams</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={grams}
                  onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <p className="text-xs text-faint">
                  ≈ {Math.round((logTarget.calories * grams) / 100)} kcal · {((logTarget.protein * grams) / 100).toFixed(1)}g protein
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setLogTarget(null)} className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold">{t('common.cancel')}</button>
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={submitLog}
                  disabled={logSubmitting}
                  className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {logSubmitting ? 'Logging…' : 'Log Food'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
