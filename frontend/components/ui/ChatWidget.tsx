
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useMotionPrefs,
  buttonPress,
  breathTransition,
  staggerContainer,
  weightedTransition,
} from '../../lib/motion';
import { Magnetic } from '../shared/MotionWrappers';
import { ChatVisual } from '../../3d/PageSpecificVisuals';
import aiService from '../../services/aiService';
import { useI18n } from '../../lib/i18n/useI18n';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

export const ChatWidget: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const { isLgUp } = useBreakpoint();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: t('ai.widgetGreeting') }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: shouldSimplify ? 'auto' : 'smooth',
      });
    }
  }, [messages, isLoading, shouldSimplify]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, userMessage].slice(-8).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        content: m.text,
      }));
      const res = await aiService.chat(
        history,
        'You are Taqwin AI, a precise, helpful, and calm fitness assistant. Keep responses concise and professional.'
      );
      if (res.error) {
        setMessages((prev) => [...prev, { role: 'ai', text: res.error || 'Neural logic timeout. Please retry.' }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: res.data?.reply || 'Neural logic timeout. Please retry.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Spectral link failure.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const panelClasses = isLgUp
    ? 'w-[400px] h-[550px] rounded-[2.5rem]'
    : 'inset-x-0 bottom-0 w-full h-[min(90dvh,600px)] rounded-t-[2rem] safe-bottom';

  const containerClasses = isLgUp
    ? 'fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4'
    : 'fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end pointer-events-none';

  const launcherClasses = isLgUp
    ? 'pointer-events-auto'
    : 'pointer-events-auto fixed end-4 bottom-20 safe-bottom';

  return (
    <div className={containerClasses}>
      <AnimatePresence>
        {isOpen && (
          <>
            {!isLgUp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[99] pointer-events-auto"
                onClick={() => setIsOpen(false)}
              />
            )}
            <motion.div
              initial={isLgUp ? { opacity: 0, scale: 0.8, y: 40 } : { opacity: 0, y: '100%' }}
              animate={isLgUp ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
              exit={isLgUp ? { opacity: 0, scale: 0.8, y: 40 } : { opacity: 0, y: '100%' }}
              transition={shouldSimplify ? { duration: 0.2 } : weightedTransition}
              className={`glass-panel flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)] border-subtle pointer-events-auto z-[100] ${panelClasses} ${!isLgUp ? 'fixed' : ''}`}
            >
              <div className="p-4 sm:p-6 border-b border-subtle flex items-center justify-between bg-primary/10 backdrop-blur-3xl shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
                    <span className="material-symbols-outlined font-black text-xl">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-foreground">Neural Assistant</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-faint">Live Feedback</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="size-11 flex items-center justify-center rounded-xl hover:bg-elevated text-muted hover:text-foreground transition-colors"
                  aria-label={t('common.close')}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-hidden relative min-h-0">
                {isLgUp && (
                  <div className="absolute inset-0 pointer-events-none opacity-5">
                    <ChatVisual />
                  </div>
                )}

                <motion.div
                  ref={scrollRef}
                  className="h-full overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar relative z-10"
                >
                  <motion.div
                    variants={staggerContainer(0.1)}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                  >
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10, y: 5 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={breathTransition}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-primary text-white rounded-tr-none'
                              : 'bg-elevated border border-subtle text-slate-200 rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <motion.div className="bg-elevated px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-subtle">
                        {[0, 0.2, 0.4].map((delay) => (
                          <motion.div
                            key={delay}
                            animate={
                              !shouldSimplify
                                ? { opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }
                                : { opacity: [0.4, 1, 0.4] }
                            }
                            transition={{ duration: 1.5, repeat: Infinity, delay, ease: 'easeInOut' }}
                            className="size-1.5 bg-primary rounded-full"
                          />
                        ))}
                      </motion.div>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              <div className="p-4 sm:p-6 bg-elevated border-t border-subtle backdrop-blur-2xl shrink-0 safe-bottom">
                <div className="flex items-center gap-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Query ecosystem..."
                    className="flex-1 min-h-11 bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-bold placeholder:text-slate-600"
                  />
                  <Magnetic strength={0.2}>
                    <motion.button
                      variants={buttonPress}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="size-11 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 disabled:opacity-50 transition-opacity shrink-0"
                    >
                      <span className="material-symbols-outlined font-black">bolt</span>
                    </motion.button>
                  </Magnetic>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!isOpen && (
        <Magnetic strength={0.4}>
          <motion.button
            onClick={() => setIsOpen(true)}
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            className={`size-14 sm:size-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 relative group overflow-hidden bg-primary shadow-primary/40 ${launcherClasses}`}
            aria-label={t('nav.aiCoach')}
          >
            <motion.div
              animate={!shouldSimplify ? { scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-white opacity-0"
            />
            <span className="material-symbols-outlined text-3xl font-black text-foreground relative z-10">
              auto_awesome
            </span>
          </motion.button>
        </Magnetic>
      )}
    </div>
  );
};
