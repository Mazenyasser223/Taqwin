
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useMotionPrefs, 
  buttonPress, 
  breathTransition, 
  staggerContainer,
  weightedTransition
} from '../../lib/motion';
import { Magnetic } from '../shared/MotionWrappers';
import { ChatVisual } from '../../3d/PageSpecificVisuals';
import aiService from '../../services/aiService';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

export const ChatWidget: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Neural link established. How can I optimize your performance parameters today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: shouldSimplify ? 'auto' : 'smooth'
      });
    }
  }, [messages, isLoading, shouldSimplify]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
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
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Spectral link failure." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40, originX: '90%', originY: '90%' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            transition={shouldSimplify ? { duration: 0.2 } : weightedTransition}
            className="w-[400px] h-[550px] glass-panel rounded-[2.5rem] flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)] border-white/10"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-primary/10 backdrop-blur-3xl">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
                  <span className="material-symbols-outlined font-black text-xl">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white">Neural Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Feedback</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="size-10 flex items-center justify-center rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 pointer-events-none opacity-5">
                <ChatVisual />
              </div>
              
              <div 
                ref={scrollRef}
                className="h-full overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-10"
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
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-white/5 border border-white/5 text-slate-200 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {isLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-white/5">
                      {[0, 0.2, 0.4].map((delay) => (
                        <motion.div
                          key={delay}
                          animate={!shouldSimplify ? { 
                            opacity: [0.4, 1, 0.4],
                            scale: [0.8, 1.2, 0.8] 
                          } : { opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay, ease: "easeInOut" }}
                          className="size-1.5 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white/5 border-t border-white/5 backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Query ecosystem..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-bold placeholder:text-slate-600"
                />
                <Magnetic strength={0.2}>
                  <motion.button 
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="size-11 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 disabled:opacity-50 transition-opacity"
                  >
                    <span className="material-symbols-outlined font-black">bolt</span>
                  </motion.button>
                </Magnetic>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher Button */}
      <Magnetic strength={0.4}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          variants={buttonPress}
          whileHover="hover"
          whileTap="tap"
          className={`size-20 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-500 relative group overflow-hidden ${
            isOpen ? 'bg-accent shadow-accent/40 rotate-90' : 'bg-primary shadow-primary/40'
          }`}
        >
          <motion.div 
            animate={!shouldSimplify && !isOpen ? { 
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3]
            } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-white opacity-0"
          />
          <span className="material-symbols-outlined text-4xl font-black text-white relative z-10">
            {isOpen ? 'close' : 'auto_awesome'}
          </span>
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.button>
      </Magnetic>
    </div>
  );
};
