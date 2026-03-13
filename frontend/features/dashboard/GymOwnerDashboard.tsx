
import React from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { staggerContainer, weightedTransition, buttonPress } from '../../lib/motion';
import { TiltCard, Magnetic } from '../../components/shared/MotionWrappers';
import { GymsVisual } from '../../3d/PageSpecificVisuals';

const monthlyIncome = [
  { month: 'Jan', amount: 4500 },
  { month: 'Feb', amount: 5200 },
  { month: 'Mar', amount: 4800 },
  { month: 'Apr', amount: 6100 },
  { month: 'May', amount: 5500 },
  { month: 'Jun', amount: 6700 },
];

const memberTypes = [
  { name: 'Basic', value: 400, color: '#158b8d' },
  { name: 'Premium', value: 300, color: '#f37021' },
  { name: 'Trial', value: 150, color: '#3b82f6' },
];

export const GymOwnerDashboard: React.FC = () => {
  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Gym Overview</h1>
          <p className="text-slate-400 mt-2">See how your gym is performing today.</p>
        </div>
        <Magnetic strength={0.2}>
          <button className="bg-primary text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg">
            <span className="material-symbols-outlined">add_circle</span>
            Add New Member
          </button>
        </Magnetic>
      </div>

      <motion.div 
        variants={staggerContainer(0.1)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Members', value: '850', icon: 'groups', color: 'text-primary' },
          { label: 'This Month Income', value: '$6,700', icon: 'payments', color: 'text-green-400' },
          { label: 'Gym Attendance', value: '45', icon: 'login', color: 'text-blue-400' },
          { label: 'New This Week', value: '12', icon: 'person_add', color: 'text-accent' },
        ].map((stat) => (
          <TiltCard key={stat.label}>
            <div className="glass-panel p-6 rounded-3xl border-white/5 space-y-4">
              <div className={`size-12 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
                <span className="material-symbols-outlined font-black text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">{stat.label}</p>
                <p className="text-3xl font-black">{stat.value}</p>
              </div>
            </div>
          </TiltCard>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border-white/5">
          <h3 className="text-xl font-bold mb-6">Income Last 6 Months</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyIncome}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#158b8d" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#158b8d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="month" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#112129', border: 'none', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#158b8d" fill="url(#colorIncome)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl border-white/5">
          <h3 className="text-xl font-bold mb-6">Membership Types</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={memberTypes} innerRadius={60} outerRadius={80} dataKey="value">
                  {memberTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {memberTypes.map(type => (
              <div key={type.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full" style={{ backgroundColor: type.color }} />
                  <span className="text-slate-400">{type.name}</span>
                </div>
                <span className="font-bold">{type.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
