
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, itemVariants, weightedTransition } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';

const members = [
  { id: '101', name: 'Julian Pierce', plan: 'Premium', status: 'Active', phone: '555-0101', avatar: 'https://i.pravatar.cc/150?u=julian' },
  { id: '102', name: 'Sophia Sterling', plan: 'Basic', status: 'Expired', phone: '555-0102', avatar: 'https://i.pravatar.cc/150?u=sophia' },
  { id: '103', name: 'Dante Vane', plan: 'Premium', status: 'Active', phone: '555-0103', avatar: 'https://i.pravatar.cc/150?u=dante' },
  { id: '104', name: 'Elena Frost', plan: 'Family', status: 'Active', phone: '555-0104', avatar: 'https://i.pravatar.cc/150?u=elena' },
  { id: '105', name: 'Kaelen Thorne', plan: 'Basic', status: 'Active', phone: '555-0105', avatar: 'https://i.pravatar.cc/150?u=kaelen' },
];

type StatusFilter = 'All' | 'Active' | 'Expired';

export const MemberManagement: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.id.includes(search);
    const matchesFilter = filter === 'All' || m.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Members List</h1>
          <p className="text-slate-400 mt-1">Manage and search for your gym members.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Status Filters */}
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            {(['All', 'Active', 'Expired'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  filter === f 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64 lg:w-80">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input 
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
              placeholder="Search name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <motion.div 
        layout
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
      >
        <AnimatePresence mode="popLayout">
          {filteredMembers.map(member => (
            <motion.div 
              layout 
              key={member.id} 
              variants={itemVariants} 
              exit={{ opacity: 0, scale: 0.9 }}
              transition={weightedTransition}
            >
              <TiltCard maxTilt={3}>
                <div className="glass-panel p-6 rounded-3xl border-white/5 hover:border-primary/30 transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <img src={member.avatar} className="size-14 rounded-xl object-cover" alt={member.name} />
                    <div>
                      <h3 className="text-lg font-bold leading-none">{member.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">ID: #{member.id}</p>
                    </div>
                    <div className={`ml-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      member.status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {member.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Plan</p>
                      <p className="text-sm font-bold">{member.plan}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Contact</p>
                      <p className="text-sm font-bold">{member.phone}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-xs font-bold transition-all border border-white/5">
                      View Profile
                    </button>
                    <button className="px-4 bg-primary/20 text-primary py-3 rounded-xl border border-primary/20 hover:bg-primary hover:text-white transition-all">
                      <span className="material-symbols-outlined text-sm">mail</span>
                    </button>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {filteredMembers.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"
        >
          <p className="text-slate-500 font-bold">No members found matching your search or filter.</p>
        </motion.div>
      )}
    </div>
  );
};
