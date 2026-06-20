import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { cn } from '../../lib/cn';
import { useI18n } from '../../lib/i18n/useI18n';
import nutritionService, { type BarcodeLookupResult, type PlanMealLogItem } from '../../services/nutritionService';
import { normalizeBarcodeInput } from './barcodeNormalize';
import { applyBarcodeProductToSlot } from './barcodeApply';
import type { MealCaptureApplyResult } from './mealCaptureApply';

type Props = {
  open: boolean;
  slotId: string;
  slotLabel: string;
  date: string;
  userId: string;
  isLogged: boolean;
  existingDraftItems?: PlanMealLogItem[];
  onClose: () => void;
  onApplied: (result?: MealCaptureApplyResult) => void | Promise<void>;
  onSwitchToPhoto?: () => void;
};

export function BarcodeScanModal({
  open,
  slotId,
  slotLabel,
  date,
  userId,
  isLogged,
  existingDraftItems,
  onClose,
  onApplied,
  onSwitchToPhoto,
}: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lookupLockRef = useRef(false);
  const lastLookupRef = useRef<{ code: string; at: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<BarcodeLookupResult | null>(null);
  const [grams, setGrams] = useState('100');

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const resetState = useCallback(() => {
    stopScanner();
    lookupLockRef.current = false;
    lastLookupRef.current = null;
    setManualCode('');
    setLoading(false);
    setApplying(false);
    setError(null);
    setProduct(null);
    setGrams('100');
  }, [stopScanner]);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const lookupCode = async (raw: string) => {
    const code = normalizeBarcodeInput(raw);
    if (!code) {
      setError(t('dashboard.barcodeInvalid'));
      return;
    }
    setLoading(true);
    setError(null);
    stopScanner();
    const res = await nutritionService.lookupBarcode(code);
    setLoading(false);
    if (res.error || !res.data?.product) {
      setError(res.error || t('dashboard.barcodeNotFound'));
      return;
    }
    setProduct(res.data.product);
    setGrams(String(res.data.product.gramsDefault || 100));
  };

  const startScanner = async () => {
    if (!videoRef.current) return;
    setError(null);
    setProduct(null);
    try {
      stopScanner();
      const reader = new BrowserMultiFormatReader();
      setScanning(true);
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (result) {
            void lookupCode(result.getText());
          }
        }
      );
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : t('dashboard.barcodeCameraFailed'));
    }
  };

  const handleApply = async () => {
    if (!product) return;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0 || g > 5000) {
      setError(t('dashboard.barcodeInvalidGrams'));
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const applyRes = await applyBarcodeProductToSlot({
        userId,
        date,
        slotId,
        isLogged,
        product,
        grams: g,
        existingDraftItems,
      });
      if (applyRes.error) throw new Error(applyRes.error);
      await onApplied(applyRes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.barcodeApplyFailed'));
    } finally {
      setApplying(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barcode-scan-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 id="barcode-scan-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('dashboard.barcodeScanTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.barcodeScanSubtitle', { meal: slotLabel })}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error ? (
                <p className="rounded-lg border border-error-500/30 bg-error-500/10 px-3 py-2 text-xs font-medium text-error-600 dark:text-error-400">
                  {error}
                </p>
              ) : null}

              {!product ? (
                <>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {t('dashboard.barcodeScanHint')}
                  </p>
                  <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black/90 dark:border-gray-700">
                    <video
                      ref={videoRef}
                      className={cn('mx-auto h-48 w-full object-cover', !scanning && 'opacity-40')}
                      muted
                      playsInline
                    />
                    {!scanning ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => void startScanner()}
                          disabled={loading}
                          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {t('dashboard.barcodeStartCamera')}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {t('dashboard.barcodeManualLabel')}
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder={t('dashboard.barcodeManualPlaceholder')}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-white/[0.04] dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={loading || !manualCode.trim()}
                        onClick={() => void lookupCode(manualCode)}
                        className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {loading ? t('dashboard.loading') : t('dashboard.barcodeLookup')}
                      </button>
                    </div>
                  </div>

                  {onSwitchToPhoto ? (
                    <button
                      type="button"
                      onClick={onSwitchToPhoto}
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400"
                    >
                      {t('dashboard.barcodeSwitchPhoto')}
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="mx-auto h-24 w-24 rounded-lg object-contain"
                    />
                  ) : null}
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{product.name}</p>
                  {product.brand ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{product.brand}</p>
                  ) : null}
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {t('dashboard.barcodeProductFound')}
                    {' · '}
                    {t('dashboard.barcodePer100', {
                      kcal: String(product.macrosPer100.calories),
                      p: String(product.macrosPer100.protein),
                      c: String(product.macrosPer100.carbs),
                      f: String(product.macrosPer100.fat),
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t('dashboard.captureGrams')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={grams}
                      onChange={(e) => setGrams(e.target.value)}
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-white/[0.04]"
                    />
                    <span className="text-xs text-gray-400">g</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProduct(null);
                        setError(null);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold dark:border-gray-700"
                    >
                      {t('dashboard.barcodeScanAgain')}
                    </button>
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => void handleApply()}
                      className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {applying ? t('dashboard.loading') : t('dashboard.barcodeAddToMeal')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
