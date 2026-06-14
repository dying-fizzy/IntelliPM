import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, CheckCircle2, Sparkles, BrainCircuit, Activity, Sliders,
  GaugeCircle, Settings, FileSearch, Users, Star, UserPlus
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


const HowItWorksVisual = () => {
  const steps = [
    { num: '01', title: 'Reads the Task', icon: <FileSearch size={24} />, desc: 'AI scans the task\'s required skills, priority level, and deadline context.' },
    { num: '02', title: 'Analyzes the Team', icon: <Users size={24} />, desc: 'Cross-references every team member\'s skill profile and active task counts.' },
    { num: '03', title: 'Recommends', icon: <Star size={24} />, desc: 'Returns a ranked list of candidates with High / Medium / Low confidence ratings.' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map((step) => (
        <div
          key={step.num}
          className="rounded-lg p-8 relative overflow-hidden group hover:-translate-y-2 transition-all duration-300"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="absolute top-0 right-0 p-4 mono text-6xl font-black opacity-5 group-hover:opacity-10 transition-opacity" style={{ color: 'var(--accent)' }}>
            {step.num}
          </div>
          
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-6" style={{ background: 'rgba(0, 255, 0, 0.08)', color: 'var(--accent)' }}>
            {step.icon}
          </div>
          
          <h3 className="text-xl font-bold mb-3">{step.title}</h3>
          <p className="text-[14px] leading-relaxed opacity-60">
            {step.desc}
          </p>
        </div>
      ))}
    </div>
  );
};


const ConfidenceVisual = () => {
  const members = [
    { name: 'Sarah K.', role: 'Frontend Engineer', skills: ['React', 'TypeScript'], match: 'High Match', matchColor: '#22c55e', workload: 35 },
    { name: 'James R.', role: 'Full Stack Dev', skills: ['React', 'CSS'], match: 'Medium Match', matchColor: '#f59e0b', workload: 68 },
    { name: 'Ali M.', role: 'Backend Engineer', skills: ['Node.js'], match: 'Low Match', matchColor: '#6b7280', workload: 15 },
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
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Target: "Build Dashboard UI"</span>
        </div>
        <span className="mono text-[10px] uppercase opacity-40">3 Recommendations</span>
      </div>

      <div className="flex flex-col gap-3">
        {members.map((m, i) => (
          <div
            key={m.name}
            className="rounded-md p-4 flex items-center gap-4 transition-all"
            style={{
              background: i === 0 ? `${m.matchColor}08` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${i === 0 ? `${m.matchColor}25` : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-black"
              style={{ background: `${m.matchColor}15`, color: m.matchColor }}
            >
              {m.name.split(' ').map(n => n[0]).join('')}
            </div>

            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-bold">{m.name}</span>
                <span className="mono text-[9px] uppercase" style={{ opacity: 0.3 }}>{m.role}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {m.skills.map(s => (
                  <span key={s} className="mono text-[8px] uppercase px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
               <span
                className="mono text-[9px] font-bold uppercase px-2.5 py-1 rounded-sm"
                style={{ background: `${m.matchColor}18`, color: m.matchColor, border: `1px solid ${m.matchColor}30` }}
               >
                 {m.match}
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const WorkloadVisual = () => {
  const workloads = [
    { name: 'Sarah K.', count: 3, percentage: 35, status: 'Available', color: '#22c55e' },
    { name: 'James R.', count: 6, percentage: 75, status: 'Moderate', color: '#f59e0b' },
    { name: 'Ali M.', count: 9, percentage: 95, status: 'Overloaded', color: '#ef4444' },
  ];

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="flex items-center gap-2 mb-6">
        <Activity size={16} />
        <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Current Workload</span>
      </div>

      <div className="flex flex-col gap-5">
        {workloads.map((w) => (
          <div key={w.name}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold opacity-80">{w.name}</span>
                <div className="flex items-center gap-2">
                   <span className="mono text-[9px] uppercase opacity-40">{w.count} Active Tasks</span>
                   <span
                      className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${w.color}15`, color: w.color }}
                   >
                     {w.status}
                   </span>
                </div>
             </div>
             
             <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.06)' }}>
               <div
                 className="h-full rounded-full"
                 style={{
                   width: `${w.percentage}%`,
                   background: w.color,
                   boxShadow: `0 0 8px ${w.color}40`,
                 }}
               />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const AdminControlsVisual = () => {
  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
        <Settings size={16} style={{ color: 'var(--accent)' }}/>
        <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>Algorithm Tuning</span>
      </div>

      <div className="flex flex-col gap-6">
        <div>
           <div className="flex justify-between items-end mb-3">
             <div className="flex flex-col">
                <span className="text-[13px] font-bold mb-1">Skill Weight Match</span>
                <span className="text-[11px] opacity-40">Prioritize exact skill match over availability</span>
             </div>
             <span className="mono text-[11px] font-bold" style={{ color: 'var(--accent)' }}>65%</span>
           </div>
           
           <div className="relative w-full h-1.5 bg-white/10 rounded-full">
             <div className="absolute left-0 top-0 h-full bg-[var(--accent)] rounded-full" style={{ width: '65%' }}></div>
             <div className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-[var(--bg-primary)] transition-transform hover:scale-110" style={{ left: '65%' }}></div>
           </div>
        </div>

        <div>
           <div className="flex justify-between items-end mb-3">
             <div className="flex flex-col">
                <span className="text-[13px] font-bold mb-1">Availability Match</span>
                <span className="text-[11px] opacity-40">Prioritize team members with least workload</span>
             </div>
             <span className="mono text-[11px] font-bold text-blue-400">35%</span>
           </div>
           
           <div className="relative w-full h-1.5 bg-white/10 rounded-full">
             <div className="absolute left-0 top-0 h-full bg-blue-400 rounded-full" style={{ width: '35%' }}></div>
             <div className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-[var(--bg-primary)] transition-transform hover:scale-110" style={{ left: '35%' }}></div>
           </div>
        </div>
      </div>
      
      <div className="mt-8 p-3 rounded-md border border-white/5 bg-white/5 flex items-start gap-3">
         <Sliders size={14} className="shrink-0 mt-0.5 opacity-50" />
         <p className="text-[10px] leading-relaxed opacity-60">
           Algorithm settings dictate how Smart Assign models weigh its suggestions network-wide. 
           Adjust ratios to govern resource balancing strictness dynamically.
         </p>
      </div>
    </div>
  );
};


const SmartAssignPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <BrainCircuit size={14} /> AI Engine
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Stop Guessing. <br className="hidden md:block" /> Let AI Pick the Right Person.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Smart Assign analyzes your entire team's skills and current workload in real time, 
            then recommends the best person for every task — with a confidence score.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 group text-[13px] font-black uppercase tracking-[0.2em] bg-[var(--accent)] text-black px-8 py-4 rounded-sm transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,255,0,0.3)]"
          >
            Get Started
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* HOW IT WORKS */}
        <section ref={ref} className="w-full px-6 md:px-12 lg:px-20 py-24 border-t border-white/5" style={{
           opacity: visible ? 1 : 0,
           transform: visible ? 'translateY(0)' : 'translateY(40px)',
           transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
        }}>
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl lg:text-[2.8rem] font-black leading-[1.1] tracking-tight mb-4 text-[var(--text-primary)]">
                How Smart Assign Works
             </h2>
             <div className="mx-auto w-12 h-1 bg-[var(--accent)] rounded-sm"></div>
           </div>
           
           <HowItWorksVisual />
        </section>

        {/* FEATURE SECTIONS */}
        <div className="w-full flex flex-col gap-0 pb-24">
          <Section
            tag="AI Recommendations"
            heading="Transparency in Every Recommendation"
            body={
              <p>
                Every suggestion comes with a confidence rating so managers always stay in control. 
                High confidence means strong skill match AND low workload. Medium means partial match. 
                Low means available but not ideally suited for the specific tech stack requested. 
                You're in the driver's seat; AI is the navigator.
              </p>
            }
            visual={<ConfidenceVisual />}
          />

          <Section
            tag="Burnout Prevention"
            heading="Never Overload Your Best People"
            body={
              <p>
                Smart Assign is completely aware of each member's active task count and workload status. 
                Even if an engineer is the most skilled at a specific framework, if they are already 
                overloaded, the system automatically flags their workload and recommends someone more 
                available instead.
              </p>
            }
            visual={<WorkloadVisual />}
            reversed
          />

          <Section
            tag="Algorithm Configuration"
            heading="Tune the Algorithm to Your Team's Needs"
            body={
              <p>
                Admins can dynamically adjust how much weight the AI algorithm gives to Skill Match 
                versus Resource Availability. During tight crunch periods, you can prioritize whoever is free. 
                During highly critical phases, prioritize your most skilled senior members. The engine 
                listens to your constraints.
              </p>
            }
            visual={<AdminControlsVisual />}
          />
        </div>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Let AI Handle the Hard Part.</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Stop making blind scheduling decisions and start trusting neural-driven task distribution.
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

export default SmartAssignPage;
