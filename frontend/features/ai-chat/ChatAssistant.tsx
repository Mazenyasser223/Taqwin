
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";
import { useMotionPrefs, buttonPress, breathTransition, snapTransition } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { ChatVisual } from '../../3d/PageSpecificVisuals';

interface Message {
  role: 'ai' | 'user';
  text: string;
}

export const ChatAssistant: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hi Alex! You look well-rested today. Ready to crush a workout?' }
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `User Name: Alex.
          Previous messages: ${messages.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n')}
          User says: ${input}`,
        config: {
          systemInstruction: "You are Taqwin AI, a friendly fitness coach. Use simple, everyday English. Be helpful and encouraging. Don't use technical jargon.",
          temperature: 0.6,
        }
      });

      const aiText = response.text || "I'm having trouble connecting. Try again in a second!";
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Something went wrong. Check your internet!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-10 max-w-5xl mx-auto relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-10">
         <ChatVisual />
      </div>

      <div 
        ref={scrollRef}
        className="flex flex-col flex-1 overflow-y-auto space-y-8 px-4 custom-scrollbar relative z-10"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={breathTransition}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-6 rounded-[2rem] shadow-xl relative ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-none' 
                  : 'bg-surface/60 backdrop-blur-xl border border-border text-white rounded-tl-none'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-3 mb-4 text-primary">
                    <span className="material-symbols-outlined font-black animate-pulse">monitoring</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Smart Coach</span>
                  </div>
                )}
                <p className="text-lg leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/5 p-6 rounded-[2rem] rounded-tl-none flex gap-3 items-center border border-border/50">
              {[0, 0.2, 0.4].map((delay) => (
                <motion.div
                  key={delay}
                  animate={!shouldSimplify ? { y: [0, -6, 0] } : {}}
                  transition={{ duration: 1, repeat: Infinity, delay }}
                  className="size-2 bg-primary rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={snapTransition}
        className="bg-surface/80 backdrop-blur-2xl border border-border p-5 rounded-[2.5rem] flex items-center gap-6 shadow-2xl relative z-20"
      >
        <button className="p-3 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-2xl">
          <span className="material-symbols-outlined text-2xl font-black">add_photo_alternate</span>
        </button>
        <input 
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 bg-transparent border-none focus:outline-none text-xl font-bold text-white placeholder:text-slate-600 disabled:opacity-50"
          placeholder={isLoading ? "Thinking..." : "Ask me anything about your fitness..."}
        />
        <Magnetic strength={0.4}>
          <motion.button 
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-primary text-white size-14 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-3xl font-black">send</span>
          </motion.button>
        </Magnetic>
      </motion.div>
    </div>
  );
};
