import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import supportService, { type SupportTicket } from '../../services/supportService';
import uploadService from '../../services/uploadService';
import {
  getFaqForRole,
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from './supportFaq';
import type { TranslationKey } from '../../lib/i18n/translations';

const inputClass =
  'w-full rounded-xl border border-subtle bg-elevated px-4 py-3 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40';

const selectClass =
  'ui-select w-full rounded-xl border border-subtle bg-elevated px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40';

const CATEGORY_LABEL: Record<SupportCategory, TranslationKey> = {
  account: 'support.categoryAccount',
  booking: 'support.categoryBooking',
  membership: 'support.categoryMembership',
  payments: 'support.categoryPayments',
  technical: 'support.categoryTechnical',
  other: 'support.categoryOther',
};

const STATUS_LABEL: Record<SupportTicket['status'], TranslationKey> = {
  open: 'support.statusOpen',
  in_progress: 'support.statusInProgress',
  resolved: 'support.statusResolved',
};

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div className="border-b border-subtle last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-start"
        aria-expanded={open}
      >
        <span className="font-semibold text-foreground">{question}</span>
        <span
          className={`material-symbols-outlined shrink-0 text-faint transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm leading-relaxed text-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TicketRow({
  ticket,
  categoryLabel,
  statusLabel,
}: {
  ticket: SupportTicket;
  categoryLabel: string;
  statusLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(ticket.createdAt).toLocaleString();

  const statusClass =
    ticket.status === 'resolved'
      ? 'bg-primary/15 text-primary'
      : ticket.status === 'in_progress'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-slate-500/15 text-muted';

  return (
    <motion.div className="border-b border-subtle py-4 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-start"
      >
        <motion.div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{ticket.subject}</p>
          <p className="mt-1 text-xs text-faint">
            {categoryLabel} · {date}
          </p>
        </motion.div>
        <motion.div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass}`}>
            {statusLabel}
          </span>
          <span className={`material-symbols-outlined text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{ticket.description}</p>
            {ticket.imageUrl && (
              <a
                href={ticket.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block"
              >
                <img
                  src={ticket.imageUrl}
                  alt=""
                  className="max-h-40 rounded-xl border border-subtle object-cover"
                />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const SupportPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<SupportCategory>('other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const faqItems = useMemo(() => getFaqForRole(user?.role), [user?.role]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    const res = await supportService.listTickets();
    if (res.data) setTickets(res.data);
    setTicketsLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    const res = await uploadService.uploadImage(file, 'support');
    setUploadingImage(false);
    if (res.error || !res.url) {
      setImageUrl(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setError(res.error || t('support.imageUploadFailed'));
      return;
    }
    setImageUrl(res.url);
  };

  const clearImage = () => {
    setImageUrl(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();
    if (trimmedSubject.length < 2) {
      setError(t('support.subjectRequired'));
      return;
    }
    if (trimmedDesc.length < 10) {
      setError(t('support.descriptionRequired'));
      return;
    }
    if (uploadingImage) return;

    setSubmitting(true);
    const res = await supportService.createTicket({
      category,
      subject: trimmedSubject,
      description: trimmedDesc,
      imageUrl,
    });
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setSubject('');
    setDescription('');
    setCategory('other');
    clearImage();
    setSuccess(true);
    void loadTickets();
  };

  return (
    <motion.div className="mx-auto max-w-2xl space-y-6">
      <motion.div className="flex items-center gap-3">
        <motion.div className="flex size-12 items-center justify-center rounded-2xl border border-subtle bg-elevated">
          <span className="material-symbols-outlined text-2xl text-primary">help</span>
        </motion.div>
        <motion.div>
          <h1 className="text-2xl font-black text-foreground">{t('support.title')}</h1>
          <p className="text-sm text-muted">{t('support.subtitle')}</p>
        </motion.div>
      </motion.div>

      <motion.div className="glass-panel overflow-hidden rounded-2xl border border-subtle px-5 sm:px-6">
        <section className="border-b border-subtle py-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-faint">
            {t('support.historyTitle')}
          </h2>
          {ticketsLoading ? (
            <p className="animate-pulse text-sm text-muted">{t('support.historyLoading')}</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted">{t('support.historyEmpty')}</p>
          ) : (
            <motion.div>
              {tickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  categoryLabel={t(CATEGORY_LABEL[ticket.category])}
                  statusLabel={t(STATUS_LABEL[ticket.status])}
                />
              ))}
            </motion.div>
          )}
        </section>

        <section className="border-b border-subtle py-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-faint">
            {t('support.faqTitle')}
          </h2>
          <motion.div>
            {faqItems.map((item) => (
              <FaqItem key={item.q} question={t(item.q)} answer={t(item.a)} />
            ))}
          </motion.div>
        </section>

        <section className="border-b border-subtle py-5">
          <Link
            to="/ai-assistant"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-subtle bg-elevated px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-elevated-hover hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">chat</span>
            {t('support.chatAi')}
          </Link>
        </section>

        <section className="py-5">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-faint">
            {t('support.contactTitle')}
          </h2>

          {success && (
            <motion.div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              {t('support.sentSuccess')}
            </motion.div>
          )}
          {error && (
            <motion.div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                {t('support.categoryLabel')}
              </label>
              <select
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                disabled={submitting}
              >
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_LABEL[c])}
                  </option>
                ))}
              </select>
            </motion.div>

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('support.subjectPlaceholder')}
              className={inputClass}
              disabled={submitting}
              maxLength={120}
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('support.descriptionPlaceholder')}
              rows={5}
              className={`${inputClass} resize-none`}
              disabled={submitting}
              maxLength={4000}
            />

            <motion.div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-faint">
                {t('support.attachImage')}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleImagePick}
                disabled={submitting || uploadingImage}
              />
              <motion.div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={submitting || uploadingImage}
                  className="rounded-xl border border-subtle bg-elevated px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-elevated-hover disabled:opacity-50"
                >
                  <span className="material-symbols-outlined align-middle text-base me-1">image</span>
                  {uploadingImage ? t('support.uploadingImage') : t('support.attachImage')}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="text-xs font-bold text-red-500"
                  >
                    {t('support.removeImage')}
                  </button>
                )}
              </motion.div>
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt=""
                  className="max-h-32 rounded-xl border border-subtle object-cover"
                />
              )}
            </motion.div>

            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">send</span>
              {submitting ? t('support.sending') : t('support.sendMessage')}
            </button>
          </form>
        </section>
      </motion.div>
    </motion.div>
  );
};
