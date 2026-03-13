
import React from 'react';
import { motion } from 'framer-motion';
import { useMotionPrefs, staggerContainer, itemVariants, weightedTransition, snapTransition } from '../../lib/motion';
import { OrdersVisual } from '../../3d/PageSpecificVisuals';

const orders = [
  { id: 'TK-9281', date: 'Oct 24, 2024', status: 'Deployed', total: 64.99, items: ['Neural Whey Isolate'], icon: 'inventory_2' },
  { id: 'TK-8172', date: 'Oct 12, 2024', status: 'Verified', total: 199.00, items: ['Neural Recovery Gun'], icon: 'medical_services' },
  { id: 'TK-7261', date: 'Sep 28, 2024', status: 'Archive', total: 45.00, items: ['Compression 2.0'], icon: 'apparel' },
];

export const OrderHistory: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <div className="flex justify-between items-end relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={weightedTransition}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-primary mb-2">
            <span className="material-symbols-outlined font-black">receipt_long</span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Inventory: Transaction Stream</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Market <span className="text-primary italic">Vault</span></h1>
          <p className="text-slate-400 mt-2 font-medium">History of your kinetic gear and fuel acquisitions.</p>
        </motion.div>
        
        <div className="absolute -top-10 right-0 w-64 h-64 pointer-events-none opacity-40">
           <OrdersVisual />
        </div>
      </div>

      <motion.div 
        variants={staggerContainer(0.1)}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {orders.map((order) => (
          <motion.div 
            key={order.id} 
            variants={itemVariants}
            className="glass-panel p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 border border-white/5 hover:border-primary/20 transition-all group"
          >
            <div className="size-16 bg-white/5 rounded-2xl flex items-center justify-center text-primary border border-white/5 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl font-black">{order.icon}</span>
            </div>

            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{order.id}</p>
              <h3 className="text-xl font-black text-white">{order.items.join(', ')}</h3>
              <p className="text-sm font-medium text-slate-500">{order.date}</p>
            </div>

            <div className="flex items-center gap-10">
               <div className="text-right">
                  <p className="text-2xl font-black tabular-nums">${order.total}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Total Credits</p>
               </div>
               
               <div className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                 order.status === 'Deployed' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' :
                 order.status === 'Verified' ? 'bg-primary/10 border-primary/20 text-primary' :
                 'bg-white/5 border-white/10 text-slate-500'
               }`}>
                 {order.status}
               </div>

               <button className="p-3 text-slate-600 hover:text-white transition-colors">
                 <span className="material-symbols-outlined">chevron_right</span>
               </button>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
