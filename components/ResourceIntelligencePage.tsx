import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, Activity, ShieldAlert, BarChart3, PieChart, Focus,
  GripHorizontal, Users, CheckCircle, Database
} from 'lucide-react';

const useInView = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
};

interface SectionProps {
  tag?: string;
  heading: string;
  body: React.ReactNode;
  visual?: React.ReactNode;
  reversed?: boolean;
}

const Section: React.FC<SectionProps> = ({ tag, heading, body, visual, reversed }) => {
  const { ref, visible } = useInView(0.12);

  return (
    <section
      ref={ref}
      className="w-full px-6 md:px-12 lg:px-20 py-24"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div
        className="w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-16"
      >
        <div className={reversed ? 'lg:order-2' : ''}>
          {tag && (
            <div className="flex items-center gap-3 mb-6">
              <span
                className="mono text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--accent)' }}
              >
                {tag}
              </span>
            </div>
          )}

          <h2
            className="text-3xl md:text-4xl lg:text-[2.8rem] font-black leading-[1.1] tracking-tight mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {heading}
          </h2>
          <div
            className="mb-8"
            style={{
              width: '48px',
              height: '3px',
              background: 'var(--accent)',
              borderRadius: '2px',
            }}
          />

          <div
            className="text-base md:text-lg leading-relaxed"
            style={{ opacity: 0.65, maxWidth: '540px' }}
          >
            {body}
          </div>
        </div>

        {visual && (
          <div className={`w-full flex justify-center ${reversed ? 'lg:order-1' : ''}`}>
            {visual}
          </div>
        )}
      </div>
    </section>
  );
};


const WorkloadVisual = () => {
  const members = [
    { name: 'Sarah K.', tasks: 3, percentage: 30, status: 'Available', color: '#22c55e' },
    { name: 'James R.', tasks: 6, percentage: 60, status: 'Moderate', color: '#f59e0b' },
    { name: 'Ali M.', tasks: 10, percentage: 100, status: 'Overloaded', color: '#ef4444' },
    { name: 'Zara T.', tasks: 2, percentage: 20, status: 'Available', color: '#22c55e' },
    { name: 'Omar H.', tasks: 7, percentage: 70, status: 'Moderate', color: '#f59e0b' },
  ];

  return (
    <div
      className="w-full rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--accent)' }} />
          <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Engineers Bandwidth</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {members.map((m) => (
          <div key={m.name}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold opacity-80">{m.name}</span>
                <div className="flex items-center gap-2">
                   <span className="mono text-[10px] uppercase opacity-40">{m.tasks} Tasks</span>
                   <span
                      className="mono text-[8px] font-bold uppercase px-2 py-0.5 rounded-sm"
                      style={{ background: `${m.color}15`, color: m.color }}
                   >
                     {m.status}
                   </span>
                </div>
             </div>
             
             <div className="w-full rounded-full overflow-hidden" style={{ height: '8px', background: 'rgba(255,255,255,0.06)' }}>
               <div
                 className="h-full rounded-full transition-all duration-1000"
                 style={{
                   width: `${m.percentage}%`,
                   background: m.color,
                   boxShadow: `0 0 10px ${m.color}60`,
                 }}
               />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const SkillMatrixVisual = () => {
   const skills = ['React', 'Node.js', 'Python', 'SQL', 'DevOps'];
   const members = [
      { name: 'Sarah K.', skills: [2, 1, 0, 1, 0] },
      { name: 'James R.', skills: [2, 2, 0, 0, 0] },
      { name: 'Ali M.', skills: [0, 2, 2, 1, 1] },
      { name: 'Zara T.', skills: [1, 0, 2, 2, 0] },
      { name: 'Omar H.', skills: [0, 1, 0, 2, 2] },
   ];
   
   return (
       <div
         className="w-full rounded-lg overflow-x-auto"
         style={{
           background: 'rgba(255,255,255,0.03)',
           border: '1px solid rgba(255,255,255,0.07)',
           backdropFilter: 'blur(12px)',
         }}
       >
         <table className="w-full text-left border-collapse min-w-max">
            <thead>
               <tr>
                  <th className="p-4 border-b border-r border-white/5 mono text-[10px] font-bold uppercase tracking-widest opacity-50 bg-white/5">Team Member</th>
                  {skills.map(skill => (
                     <th key={skill} className="p-4 border-b border-white/5 text-center mono text-[10px] font-bold uppercase tracking-widest opacity-50 bg-white/5">
                        {skill}
                     </th>
                  ))}
               </tr>
            </thead>
            <tbody>
               {members.map(member => (
                  <tr key={member.name} className="hover:bg-white/5 transition-colors">
                     <td className="p-4 border-b border-r border-white/5 font-bold text-[12px] opacity-80">{member.name}</td>
                     {member.skills.map((level, i) => (
                        <td key={i} className="p-4 border-b border-white/5 text-center">
                           <div className="w-full h-8 flex justify-center items-center rounded-sm mx-auto overflow-hidden">
                              {level === 2 && <div className="w-full h-full" style={{ background: '#22c55e', opacity: 0.8 }} title="Proficient"></div>}
                              {level === 1 && <div className="w-full h-full" style={{ background: '#facc15', opacity: 0.6 }} title="Familiar"></div>}
                              {level === 0 && <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.02)' }} title="No Experience"></div>}
                           </div>
                        </td>
                     ))}
                  </tr>
               ))}
            </tbody>
         </table>
       </div>
   )
}


const VelocityVisual = () => {
   const members = [
      { name: 'Sarah', planned: 5, actual: 5 },
      { name: 'James', planned: 7, actual: 4 },
      { name: 'Ali', planned: 8, actual: 9 },
      { name: 'Zara', planned: 4, actual: 4 },
   ];
   
   return (
      <div
      className="w-full rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
          <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Sprint Velocity Tracker</span>
        </div>
        <div className="flex items-center gap-4 hidden sm:flex">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}></span>
              <span className="mono text-[9px] uppercase opacity-40">Planned</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }}></span>
              <span className="mono text-[9px] uppercase opacity-40">Actual closed</span>
           </div>
        </div>
      </div>
      
      <div className="flex items-end justify-between h-48 px-2 gap-4">
         {members.map(member => (
            <div key={member.name} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
               <div className="flex items-end justify-center w-full gap-1 sm:gap-2 h-full relative group">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-12 z-10 bg-black/80 border border-white/10 rounded px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col items-center">
                     <span className="mono text-[10px] opacity-80 whitespace-nowrap">{member.name}</span>
                     <span className="mono text-[9px] text-[var(--accent)] whitespace-nowrap">{member.actual} / {member.planned} completed</span>
                  </div>
                  
                  {/* Planned Bar */}
                  <div 
                     className="w-1/2 max-w-[20px] rounded-t-sm transition-all duration-1000" 
                     style={{ height: `${(member.planned / 10) * 100}%`, background: 'rgba(255,255,255,0.1)' }}
                  ></div>
                  {/* Actual Bar */}
                  <div 
                     className="w-1/2 max-w-[20px] rounded-t-sm transition-all duration-1000 origin-bottom" 
                     style={{ 
                        height: `${(member.actual / 10) * 100}%`, 
                        background: member.actual >= member.planned ? '#22c55e' : member.actual > member.planned / 2 ? '#facc15' : '#ef4444' 
                     }}
                  ></div>
               </div>
               <span className="mono text-[10px] font-bold uppercase opacity-50 mt-1">{member.name}</span>
            </div>
         ))}
      </div>
    </div>
   )
}


const ResourceIntelligencePage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Activity size={14} /> Resource Engine
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Know Who's Overwhelmed <br className="hidden md:block" /> Before They Burn Out.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            IntelliPM tracks every team member's workload in real time. 
            See who is available, who is at capacity, and who needs relief — at a glance.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 group text-[13px] font-black uppercase tracking-[0.2em] bg-[var(--accent)] text-black px-8 py-4 rounded-sm transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,255,0,0.3)]"
          >
            Get Started
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* FEATURE SECTIONS */}
        <div className="w-full flex flex-col gap-0 pb-24 border-t border-white/5">
          <Section
            tag="Bandwidth Monitoring"
            heading="Real-Time Workload for Every Team Member"
            body={
              <p>
                Every member's current task load is calculated automatically and displayed 
                as a color-coded status: Available (green), Moderate (yellow), 
                Overloaded (red). No manual tracking needed. Stop accidental over-allocation 
                before it stalls your sprint.
              </p>
            }
            visual={<WorkloadVisual />}
          />

          <Section
            tag="Skill Mapping"
            heading="See What Your Team Can Actually Do"
            body={
              <p>
                The Skill Matrix maps each team member's proficiencies across technologies 
                and disciplines. At any time, managers can see who knows what — making 
                resource decisions data-driven instead of gut-feel. Stop guessing who the 
                right fit is.
              </p>
            }
            visual={<SkillMatrixVisual />}
            reversed
          />
          
          <Section
            tag="Output Metrics"
            heading="Measure How Fast Your Team Actually Moves"
            body={
              <p>
                IntelliPM tracks each member's velocity — how many tasks they plan to 
                close vs how many they actually close per sprint. This gives managers a 
                realistic picture of team speed for future planning and identifies 
                hidden bottlenecks.
              </p>
            }
            visual={<VelocityVisual />}
          />
        </div>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Build a Healthier, Faster Team.</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Give your managers the visibility they need to load-balance perfectly.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 group text-[13px] font-black uppercase tracking-[0.2em] bg-[var(--accent)] text-black px-8 py-4 rounded-sm transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,255,0,0.3)]"
          >
            Get Started
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

      </div>
    </main>
  );
};

export default ResourceIntelligencePage;
