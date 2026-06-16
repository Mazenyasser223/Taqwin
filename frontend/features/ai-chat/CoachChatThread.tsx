import React, { useEffect, useMemo, useState } from 'react';

import { motion } from 'framer-motion';

import { breathTransition } from '../../lib/motion';

import { ChatMessageBody } from '../../components/chat/ChatMessageBody';

import { useI18n } from '../../lib/i18n/useI18n';

import { TOOL_LABEL_KEYS } from './coachChatConstants';

import type { CoachChatMessage, CoachStepUpPayload } from './coachChatTypes';

import type { AiFoodDisambiguationCandidate } from '../../services/aiService';
import { CoachTypingDots } from './CoachTypingDots';
import {
  CommerceRecommendationCard,
  commerceBundleFromToolOutput,
} from '../commerce/CommerceRecommendationCard';
import type { CommerceBundle } from '../../services/aiCommerceService';



export interface CoachChatThreadProps {

  messages: CoachChatMessage[];

  isLoading: boolean;

  pendingConfirmIndex: number | null;

  pendingDisambiguationIndex: number | null;

  onConfirm: (stepUp?: CoachStepUpPayload) => void;

  onCancel: () => void;

  onPickFoodCandidate: (candidate: AiFoodDisambiguationCandidate) => void;

  foodCandidateKey: (candidate: AiFoodDisambiguationCandidate) => string;

  variant?: 'widget' | 'page';

  isRtl?: boolean;

  showCoachBadge?: boolean;

}



function findCommerceBundle(msg: CoachChatMessage): CommerceBundle | null {
  for (const tool of msg.toolCalls ?? []) {
    if (tool.name !== 'recommend_plan_products') continue;
    const bundle = commerceBundleFromToolOutput(tool.output as Record<string, unknown> | undefined);
    if (bundle && bundle.products.length > 0) return bundle;
  }
  return null;
}

function phraseMatches(got: string, expected: string): boolean {
  const a = got.trim();
  const b = expected.trim();
  if (!a || !b) return false;
  if (/^[A-Za-z]+$/.test(b)) return a.toUpperCase() === b.toUpperCase();
  return a === b;
}

function StepUpConfirmPanel({
  msg,
  isLoading,
  onConfirm,
  onCancel,
  compact,
  inlineError,
}: {
  msg: CoachChatMessage;
  isLoading: boolean;
  onConfirm: (stepUp?: CoachStepUpPayload) => void;
  onCancel: () => void;
  compact?: boolean;
  inlineError?: string | null;
}) {
  const { t } = useI18n();
  const expectedPhrase = msg.stepUpPhrase || 'ADAPT';
  const allowsPassword = (msg.stepUpMethods || []).includes('password');
  const [mode, setMode] = useState<'phrase' | 'password'>('phrase');
  const [phraseInput, setPhraseInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const canConfirm = useMemo(() => {
    if (mode === 'password') return passwordInput.trim().length > 0;
    return phraseMatches(phraseInput, expectedPhrase);
  }, [expectedPhrase, mode, passwordInput, phraseInput]);

  const inputClass = compact
    ? 'w-full rounded-lg border border-subtle bg-elevated px-3 py-1.5 text-xs text-foreground'
    : 'w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground';

  const handleConfirm = () => {
    if (!canConfirm || isLoading) return;
    if (mode === 'password') {
      void onConfirm({ password: passwordInput });
      return;
    }
    void onConfirm({ confirmationPhrase: phraseInput.trim() });
  };

  return (
    <div className={`flex flex-col gap-2 ${compact ? 'max-w-[85%]' : 'max-w-[92%] sm:max-w-[85%]'}`}>
      <p className={`text-muted px-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {t('ai.stepUp.whyHighImpact')}
      </p>

      {inlineError ? (
        <p
          className={`rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-600 dark:text-red-400 ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
          role="alert"
        >
          {inlineError}
        </p>
      ) : null}

      {mode === 'phrase' ? (
        <label className="flex flex-col gap-1 px-1">
          <span className={`font-medium text-muted ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {t('ai.stepUp.phraseLabel', { phrase: expectedPhrase })}
          </span>
          <input
            type="text"
            value={phraseInput}
            onChange={(e) => setPhraseInput(e.target.value)}
            placeholder={t('ai.stepUp.phrasePlaceholder', { phrase: expectedPhrase })}
            disabled={isLoading}
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="step-up-phrase-hint"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 px-1">
          <span className={`font-medium text-muted ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {t('ai.stepUp.passwordLabel')}
          </span>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={t('ai.stepUp.passwordPlaceholder')}
            disabled={isLoading}
            className={inputClass}
            autoComplete="current-password"
          />
        </label>
      )}

      {allowsPassword ? (
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'phrase' ? 'password' : 'phrase'))}
          disabled={isLoading}
          className={`self-start px-1 text-primary hover:underline disabled:opacity-50 ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          {mode === 'phrase' ? t('ai.stepUp.usePassword') : t('ai.stepUp.usePhrase')}
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading || !canConfirm}
          className={`rounded-xl bg-primary font-bold text-white disabled:opacity-50 ${
            compact ? 'rounded-lg px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          {t('ai.confirmAction')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className={`rounded-xl border bg-elevated font-bold text-muted hover:text-foreground disabled:opacity-50 ${
            compact
              ? 'rounded-lg border-subtle px-3 py-1.5 text-xs'
              : 'border-border bg-surface px-4 py-2 text-sm'
          }`}
        >
          {t('ai.cancelAction')}
        </button>
      </div>
    </div>
  );
}

function ConfirmImpactSummary({ msg, compact }: { msg: CoachChatMessage; compact?: boolean }) {
  const { t } = useI18n();
  const tools = msg.toolCalls?.map((tc) => tc.name).filter(Boolean) || [];
  if (!tools.length && !msg.confirmationPreview) return null;

  return (
    <div className={`flex flex-col gap-1 px-1 ${compact ? 'text-[11px]' : 'text-sm'}`}>
      {msg.confirmationPreview ? (
        <p className="text-muted">{msg.confirmationPreview}</p>
      ) : null}
      {tools.length ? (
        <ul className="list-inside list-disc text-muted">
          {tools.slice(0, 4).map((name) => {
            const key = TOOL_LABEL_KEYS[name];
            return (
              <li key={name}>{key ? t(key) : name}</li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ConfirmActionPanel({
  msg,
  isLoading,
  onConfirm,
  onCancel,
  compact,
}: {
  msg: CoachChatMessage;
  isLoading: boolean;
  onConfirm: (stepUp?: CoachStepUpPayload) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [stepUpActive, setStepUpActive] = useState(Boolean(msg.stepUpRequired));

  useEffect(() => {
    setStepUpActive(Boolean(msg.stepUpRequired));
  }, [msg.stepUpRequired, msg.actionId]);

  useEffect(() => {
    if (!msg.stepUpEligible || msg.stepUpRequired) return undefined;
    const staleAt = msg.stepUpStaleAt ? new Date(msg.stepUpStaleAt).getTime() : null;
    if (!staleAt) return undefined;
    const delay = staleAt - Date.now();
    if (delay <= 0) {
      setStepUpActive(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setStepUpActive(true), delay);
    return () => window.clearTimeout(timer);
  }, [msg.stepUpEligible, msg.stepUpRequired, msg.stepUpStaleAt, msg.actionId]);

  const idleMinutes = Math.max(1, Math.round((msg.stepUpIdleMs || 300_000) / 60_000));
  const phrase = msg.stepUpPhrase || 'ADAPT';

  if (stepUpActive) {
    return (
      <StepUpConfirmPanel
        msg={msg}
        isLoading={isLoading}
        onConfirm={onConfirm}
        onCancel={onCancel}
        compact={compact}
        inlineError={msg.stepUpConfirmError}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${compact ? 'max-w-[85%]' : 'max-w-[92%] sm:max-w-[85%]'}`}>
      <ConfirmImpactSummary msg={msg} compact={compact} />
      {msg.stepUpEligible ? (
        <p className={`text-muted px-1 ${compact ? 'text-[11px]' : 'text-xs'}`} id="step-up-phrase-hint">
          {t('ai.stepUp.staleHint', { minutes: String(idleMinutes), phrase })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={isLoading}
          className={`rounded-xl bg-primary font-bold text-white disabled:opacity-50 ${
            compact ? 'rounded-lg px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          {t('ai.confirmAction')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className={`rounded-xl border bg-elevated font-bold text-muted hover:text-foreground disabled:opacity-50 ${
            compact
              ? 'rounded-lg border-subtle px-3 py-1.5 text-xs'
              : 'border-border bg-surface px-4 py-2 text-sm'
          }`}
        >
          {t('ai.cancelAction')}
        </button>
      </div>
    </div>
  );
}

function FoodDisambiguationPicker({

  candidates,

  gramsFallback,

  expired,

  isLoading,

  onPick,

  foodCandidateKey,

  compact,

}: {

  candidates: AiFoodDisambiguationCandidate[];

  gramsFallback?: number;

  expired?: boolean;

  isLoading: boolean;

  onPick: (candidate: AiFoodDisambiguationCandidate) => void;

  foodCandidateKey: (candidate: AiFoodDisambiguationCandidate) => string;

  compact?: boolean;

}) {

  const { t, language } = useI18n();



  const labelFor = (candidate: AiFoodDisambiguationCandidate) => {

    if (language === 'ar' && candidate.nameAr) return candidate.nameAr;

    return candidate.foodName || candidate.nameAr || t('ai.disambiguation.unknownFood');

  };



  return (

    <div className={`flex flex-col gap-2 ${compact ? 'max-w-[85%]' : 'max-w-[92%] sm:max-w-[85%]'}`}>

      {expired ? (

        <p className={`text-muted ${compact ? 'text-[11px] px-1' : 'text-sm px-1'}`}>

          {t('ai.disambiguation.expiredHint')}

        </p>

      ) : null}

      {candidates.slice(0, 3).map((candidate) => {

        const grams = candidate.grams ?? gramsFallback;

        const label = labelFor(candidate);

        return (

          <button

            key={foodCandidateKey(candidate)}

            type="button"

            disabled={isLoading || expired}

            onClick={() => onPick(candidate)}

            className={`rounded-xl border text-start transition-all disabled:opacity-50 ${

              compact

                ? 'border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15'

                : 'border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/15'

            }`}

          >

            <span className="block">{label}</span>

            {grams != null ? (

              <span className={`block font-medium opacity-80 ${compact ? 'text-[10px]' : 'text-xs'}`}>

                {t('ai.disambiguation.grams', { grams: String(grams) })}

              </span>

            ) : null}

          </button>

        );

      })}

    </div>

  );

}



export const CoachChatThread: React.FC<CoachChatThreadProps> = ({

  messages,

  isLoading,

  pendingConfirmIndex,

  pendingDisambiguationIndex,

  onConfirm,

  onCancel,

  onPickFoodCandidate,

  foodCandidateKey,

  variant = 'widget',

  isRtl = false,

  showCoachBadge = variant === 'page',

}) => {

  const { t } = useI18n();



  const toolLabel = (name: string) => {

    const key = TOOL_LABEL_KEYS[name];

    return key ? t(key) : name;

  };



  const formatToolResult = (toolName: string, output: Record<string, unknown> | undefined) => {

    if (!output) return null;

    if (toolName === 'log_food' && output.log && typeof output.log === 'object') {

      const log = output.log as {

        grams?: number;

        foodItem?: { name?: string };

      };

      const name = log.foodItem?.name || '';

      const grams = log.grams;

      if (name && grams != null) {

        return t('ai.toolResult.logFood', { name, grams: String(grams) });

      }

    }

    if (toolName === 'replace_exercise_today' && output.replaced) {

      const rep = output.replaced as { from?: string; to?: string };

      if (rep.from && rep.to) {

        return t('ai.toolResult.replaceExercise', { from: rep.from, to: rep.to });

      }

    }

    return null;

  };



  const renderInteractive = (msg: CoachChatMessage, i: number, compact: boolean) => {

    const showDisambiguation =

      msg.role === 'ai' &&

      msg.disambiguationRequired &&

      msg.disambiguationKind === 'food' &&

      (pendingDisambiguationIndex === i || msg.disambiguationExpired) &&

      (msg.candidates?.length ?? 0) > 0;



    const showConfirm =

      msg.role === 'ai' && msg.confirmationRequired && pendingConfirmIndex === i;

    const commerceBundle = msg.role === 'ai' ? findCommerceBundle(msg) : null;



    return (

      <>

        {showDisambiguation ? (
          <div className={compact ? 'mt-2' : 'mt-3'}>
            <FoodDisambiguationPicker
              candidates={msg.candidates || []}
              expired={msg.disambiguationExpired}
              isLoading={isLoading}
              onPick={onPickFoodCandidate}
              foodCandidateKey={foodCandidateKey}
              compact={compact}
            />
            {!msg.disambiguationExpired ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className={`mt-2 rounded-xl border font-bold text-muted hover:text-foreground disabled:opacity-50 ${
                  compact
                    ? 'rounded-lg border-subtle bg-elevated px-3 py-1.5 text-xs'
                    : 'border-border bg-surface px-4 py-2 text-sm'
                }`}
              >
                {t('ai.cancelAction')}
              </button>
            ) : null}
          </div>
        ) : null}

        {showConfirm ? (
          <div className={compact ? 'mt-2' : 'mt-3'}>
            <ConfirmActionPanel
              msg={msg}
              isLoading={isLoading}
              onConfirm={onConfirm}
              onCancel={onCancel}
              compact={compact}
            />
          </div>
        ) : null}

        {commerceBundle ? (
          <CommerceRecommendationCard bundle={commerceBundle} compact={compact} />
        ) : null}

      </>

    );

  };



  if (variant === 'widget') {

    return (

      <>

        {messages.map((msg, i) => (

          <motion.div

            key={i}

            initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10, y: 5 }}

            animate={{ opacity: 1, x: 0, y: 0 }}

            transition={breathTransition}

            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}

          >

            <div

              className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${

                msg.role === 'user'

                  ? 'bg-primary text-white rounded-tr-none'

                  : 'bg-elevated border border-subtle text-slate-200 rounded-tl-none'

              }`}

            >

              {msg.role === 'ai' && isLoading && i === messages.length - 1 && !msg.text.trim() ? (
                <CoachTypingDots size="sm" />
              ) : (
                <ChatMessageBody text={msg.text} />
              )}

            </div>

            {msg.role === 'ai' && msg.toolCalls && msg.toolCalls.length > 0 ? (

              <div className="mt-2 flex flex-col gap-1 max-w-[85%]">

                {msg.toolCalls.map((tool, ti) => {

                  const detail = formatToolResult(tool.name, tool.input as Record<string, unknown>);

                  return (

                    <span

                      key={`${tool.name}-${ti}`}

                      className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"

                    >

                      <span className="material-symbols-outlined text-[14px]">build</span>

                      {toolLabel(tool.name)}

                      {detail ? (

                        <span className="normal-case tracking-normal text-[10px] opacity-90">{detail}</span>

                      ) : null}

                    </span>

                  );

                })}

              </div>

            ) : null}

            {renderInteractive(msg, i, true)}

          </motion.div>

        ))}

      </>

    );

  }



  return (

    <>

      {messages.map((msg, i) => (

        <motion.div

          key={i}

          initial={{ opacity: 0, y: 20, scale: 0.98 }}

          animate={{ opacity: 1, y: 0, scale: 1 }}

          transition={breathTransition}

          className={`flex flex-col ${msg.role === 'user' ? (isRtl ? 'items-start' : 'items-end') : isRtl ? 'items-end' : 'items-start'}`}

        >

          <div

            className={`max-w-[92%] sm:max-w-[85%] p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xl ${

              msg.role === 'user'

                ? `bg-primary text-white ${isRtl ? 'rounded-tl-none' : 'rounded-tr-none'}`

                : `bg-surface/60 backdrop-blur-xl border border-border text-foreground ${isRtl ? 'rounded-tr-none' : 'rounded-tl-none'}`

            }`}

          >

            {msg.role === 'ai' && showCoachBadge ? (

              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-primary">

                <span
                  className="material-symbols-outlined font-black animate-pulse text-lg sm:text-xl"
                  aria-hidden
                >
                  smart_toy
                </span>

                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">

                  {t('ai.coachBadge')}

                </span>

              </div>

            ) : null}

            {msg.role === 'ai' && isLoading && i === messages.length - 1 && !msg.text.trim() ? (
              <CoachTypingDots size="md" />
            ) : (
              <ChatMessageBody text={msg.text} className="text-base sm:text-lg leading-relaxed font-medium" />
            )}

          </div>

          {msg.role === 'ai' && msg.toolCalls && msg.toolCalls.length > 0 ? (

            <div className="mt-2 flex flex-col gap-1.5 max-w-[92%] sm:max-w-[85%]">

              {msg.toolCalls.map((tool, ti) => {

                const detail = formatToolResult(tool.name, tool.output as Record<string, unknown>);

                return (

                  <span

                    key={`${tool.name}-${ti}`}

                    className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"

                  >

                    <span className="material-symbols-outlined text-base">build</span>

                    {toolLabel(tool.name)}

                    {detail ? (

                      <span className="font-medium normal-case text-foreground/80">{detail}</span>

                    ) : null}

                  </span>

                );

              })}

            </div>

          ) : null}

          {renderInteractive(msg, i, false)}

        </motion.div>

      ))}

    </>

  );

};


