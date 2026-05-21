
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPrefs, buttonPress, breathTransition, snapTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { ChatVisual } from '../../3d/PageSpecificVisuals';
import aiService from '../../services/aiService';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';
import { ChatMessageBody } from '../../components/chat/ChatMessageBody';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

export const ChatAssistant: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const { isLgUp } = useBreakpoint();
  const { t, language, dir, isRtl } = useI18n();
  const userName = useAuthStore((s) => s.user?.profile?.displayName || s.user?.email?.split('@')[0] || 'athlete');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `Hi ${userName}! You look well-rested today. Ready to crush a workout?` },
  ]);
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
      const history = [...messages, userMessage].slice(-10).map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        content: m.text,
      }));
      const res = await aiService.chat(history, { locale: language });
      if (res.error) {
        setMessages((prev) => [...prev, { role: 'ai', text: res.error || "I'm having trouble connecting. Try again in a second!" }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: res.data?.reply || "I'm not sure how to answer that. Could you rephrase?" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Something went wrong. Check your internet!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      dir={dir}
      className="flex flex-1 flex-col min-h-0 w-full min-w-0 max-w-5xl mx-auto relative"
    >
      {isLgUp && (
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-10">
          <ChatVisual />
        </motion.div>
      )}

      <motion.div
        ref={scrollRef}
        className="flex flex-col flex-1 overflow-y-auto min-h-0 space-y-6 sm:space-y-8 px-2 sm:px-4 custom-scrollbar relative z-10 pb-4"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={breathTransition}
              className={`flex ${msg.role === 'user' ? (isRtl ? 'justify-start' : 'justify-end') : isRtl ? 'justify-end' : 'justify-start'}`}
            >
              <motion.div
                className={`max-w-[92%] sm:max-w-[85%] p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xl relative ${
                  msg.role === 'user'
                    ? `bg-primary text-white ${isRtl ? 'rounded-tl-none' : 'rounded-tr-none'}`
                    : `bg-surface/60 backdrop-blur-xl border border-border text-foreground ${isRtl ? 'rounded-tr-none' : 'rounded-tl-none'}`
                }`}
              >
                {msg.role === 'ai' && (
                  <motion.div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-primary">
                    <span className="material-symbols-outlined font-black animate-pulse text-lg sm:text-xl">monitoring</span>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">Smart Coach</span>
                  </motion.div>
                )}
                <ChatMessageBody text={msg.text} className="text-base sm:text-lg leading-relaxed font-medium" />
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <motion.div className="bg-elevated p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] rounded-tl-none flex gap-3 items-center border border-border/50">
              {[0, 0.2, 0.4].map((delay) => (
                <motion.div
                  key={delay}
                  animate={!shouldSimplify ? { y: [0, -6, 0] } : {}}
                  transition={{ duration: 1, repeat: Infinity, delay }}
                  className="size-2 bg-primary rounded-full"
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={snapTransition}
        className="bg-surface/80 backdrop-blur-2xl border border-border p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] flex items-center gap-3 sm:gap-6 shadow-2xl relative z-20 shrink-0 safe-bottom"
      >
        <button
          type="button"
          className="hidden sm:flex p-3 text-faint hover:text-foreground transition-colors hover:bg-elevated rounded-2xl min-h-11 min-w-11 items-center justify-center"
          aria-hidden
        >
          <span className="material-symbols-outlined text-2xl font-black">add_photo_alternate</span>
        </button>
        <input
          value={input}
          disabled={isLoading}
          dir="auto"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 min-h-11 bg-transparent border-none focus:outline-none text-base sm:text-xl font-bold text-foreground placeholder:text-slate-600 disabled:opacity-50 text-start [unicode-bidi:plaintext]"
          placeholder={isLoading ? t('ai.thinking') : t('ai.placeholder')}
        />
        <Magnetic strength={0.4}>
          <motion.button
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-primary text-white size-11 sm:size-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-2xl sm:text-3xl font-black">send</span>
          </motion.button>
        </Magnetic>
      </motion.div>
    </motion.div>
  );
};
