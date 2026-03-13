
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useMotionPrefs, 
  staggerContainer, 
  itemVariants, 
  buttonPress, 
  snapTransition 
} from '../../lib/motion';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';
import { CommunityVisual } from '../../3d/PageSpecificVisuals';

const initialPosts = [
  {
    id: '1',
    user: 'Sarah Kinetic',
    avatar: 'https://i.pravatar.cc/150?u=sarah',
    content: 'Just analyzed my neural load after the Heavy Squat session. 140kg x 5 felt like air today! Consensus is definitely building. 🏋️‍♀️',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000',
    likes: 124,
    tags: ['AI Optimized', 'Kinetic'],
    time: '2h ago',
    hasLiked: false
  },
  {
    id: '2',
    user: 'Marcus Flow',
    avatar: 'https://i.pravatar.cc/150?u=marcus',
    content: 'Macros locked for the week. Taqwin AI generated a plant-based kinetic plan that actually hits 180g protein easily. 🌱',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=1000',
    likes: 89,
    tags: ['Nutrition', 'Eco-Flow'],
    time: '5h ago',
    hasLiked: false
  }
];

export const CommunityFeed: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const [posts, setPosts] = useState(initialPosts);

  const toggleLike = (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.hasLiked ? post.likes - 1 : post.likes + 1,
          hasLiked: !post.hasLiked
        };
      }
      return post;
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="flex justify-between items-end relative">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={snapTransition}
          className="relative z-10"
        >
          <h1 className="text-4xl font-black tracking-tight">Eco-Social</h1>
          <p className="text-slate-400 mt-2 font-medium">Synced with 4,200 active kinetic pulses.</p>
        </motion.div>
        
        <div className="relative z-10">
          <Magnetic>
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              className="bg-primary text-white font-black px-8 py-3.5 rounded-2xl flex items-center gap-3 shadow-2xl shadow-primary/30"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Broadcast Progress
            </motion.button>
          </Magnetic>
        </div>

        {/* Unique 3D Social Visual */}
        <div className="absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
           <CommunityVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {posts.map((post) => (
          <motion.div
            key={post.id}
            variants={itemVariants}
            className="bg-surface/50 border border-border rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-primary/40 transition-all"
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="size-14 rounded-full border-2 border-primary/20 p-1">
                  <img src={post.avatar} className="size-full rounded-full object-cover" alt={post.user} />
                </div>
                <div>
                  <h3 className="font-black text-xl group-hover:text-primary transition-colors">{post.user}</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{post.time}</p>
                </div>
              </div>
              <button className="text-slate-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined">hub</span>
              </button>
            </div>

            <div className="px-8 pb-4">
              <p className="text-slate-200 text-lg leading-relaxed mb-6 font-medium">{post.content}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {post.tags.map(tag => (
                  <span key={tag} className="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-primary uppercase tracking-widest">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {post.image && (
              <div className="aspect-video overflow-hidden bg-black/40">
                <img src={post.image} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-1000" alt="Kinetic content" />
              </div>
            )}

            <div className="p-8 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-10">
                <button 
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-3 transition-colors group ${post.hasLiked ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                >
                  <motion.span 
                    animate={post.hasLiked && !shouldSimplify ? { scale: [1, 1.6, 1], rotate: [0, -20, 0] } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    className="material-symbols-outlined text-2xl"
                    style={{ fontVariationSettings: post.hasLiked ? "'FILL' 1" : "" }}
                  >
                    favorite
                  </motion.span>
                  <span className="text-sm font-black tabular-nums">{post.likes}</span>
                </button>
                <button className="flex items-center gap-3 text-slate-400 hover:text-primary transition-colors group">
                  <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">mode_comment</span>
                  <span className="text-sm font-black">12</span>
                </button>
              </div>
              <button className="text-slate-400 hover:text-primary transition-colors">
                <span className="material-symbols-outlined">share</span>
              </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
