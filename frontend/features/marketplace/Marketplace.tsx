
import React from 'react';
import { motion } from 'framer-motion';
import { 
  useMotionPrefs, 
  staggerContainer, 
  itemVariants, 
  buttonPress, 
  snapTransition 
} from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { MarketplaceVisual } from '../../3d/PageSpecificVisuals';

const products = [
  { id: '1', name: 'Neural Whey Isolate', brand: 'Taqwin Tech', price: 64.99, img: 'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400' },
  { id: '2', name: 'Kevlar Lift Straps', brand: 'HeavyDuty', price: 29.99, img: 'https://images.unsplash.com/photo-1544033527-b192daee1f5b?q=80&w=400' },
  { id: '3', name: 'Neural Recovery Gun', brand: 'Taqwin Tech', price: 199.00, img: 'https://images.unsplash.com/photo-1594737626072-90dc274bc2bd?q=80&w=400' },
  { id: '4', name: 'Compression 2.0', brand: 'ActiveArmor', price: 45.00, img: 'https://images.unsplash.com/photo-1557167668-6ebd073f27c1?q=80&w=400' },
];

export const Marketplace: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();

  return (
    <div className="space-y-12">
      {/* Commerce-Themed Header */}
      <div className="flex justify-between items-center relative">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={snapTransition}
          className="relative z-10"
        >
          <h1 className="text-4xl font-black tracking-tight">Kinetic Market</h1>
          <p className="text-slate-400 mt-2">Gear and biology verified by ecosystem consensus.</p>
        </motion.div>
        
        <div className="relative z-10">
          <Magnetic>
            <motion.button 
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              className="bg-surface/60 border border-border px-6 py-3 rounded-2xl flex items-center gap-3 font-black shadow-xl"
            >
               <span className="material-symbols-outlined text-primary">shopping_bag</span>
               Vault (02)
            </motion.button>
          </Magnetic>
        </div>

        {/* Unique 3D Token Visual */}
        <div className="absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
           <MarketplaceVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
      >
        {products.map((product) => (
          <TiltCard key={product.id}>
            <motion.div
              variants={itemVariants}
              className="bg-surface border border-border rounded-[2.5rem] overflow-hidden group hover:border-primary transition-all flex flex-col h-full shadow-2xl"
            >
              <div className="aspect-square relative overflow-hidden bg-white/5">
                <img 
                  src={product.img} 
                  className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                  alt={product.name} 
                />
                {!shouldSimplify && (
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="absolute top-6 left-6 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  System Verified
                </div>
              </div>
              
              <div className="p-8 flex flex-col flex-1 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{product.brand}</p>
                  <h3 className="text-xl font-black leading-tight group-hover:text-primary transition-colors">{product.name}</h3>
                </div>
                
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="text-2xl font-black tabular-nums">${product.price}</span>
                  <Magnetic strength={0.4}>
                    <motion.button 
                      whileTap={{ scale: 0.85 }}
                      className="size-14 bg-primary text-white rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-primary/30 group-hover:bg-accent group-hover:shadow-accent/30 transition-all duration-300"
                    >
                      <span className="material-symbols-outlined font-black">add_shopping_cart</span>
                    </motion.button>
                  </Magnetic>
                </div>
              </div>
            </motion.div>
          </TiltCard>
        ))}
      </motion.div>
    </div>
  );
};
