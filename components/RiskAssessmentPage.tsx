import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, ShieldAlert, Cpu, Activity, AlertTriangle, Users, 
  Wallet, CalendarDays, Fingerprint, Radar, Target
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


const MLInputsVisual = () => {
   const inputs = [
      { title: 'Team Size & Composition', icon: <Users size={20} />, stat: '24 Variables' },
      { title: 'Budget vs Scope', icon: <Wallet size={20} />, stat: '12 Variables' },
      { title: 'Timeline vs Complexity', icon: <CalendarDays size={20} />, stat: '18 Variables' },
   ];
   
   return (
      <div className="flex flex-col gap-4 w-full max-w-sm ml-auto">
         {inputs.map((input, i) => (
            <div
               key={i}
               className="rounded-lg p-5 flex items-center justify-between"
               style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
               }}
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                     {input.icon}
                  </div>
                  <span className="text-[14px] font-bold">{input.title}</span>
               </div>
               <span className="mono text-[10px] font-bold opacity-40">{input.stat}</span>
            </div>
         ))}
      </div>
   )
}


const RiskScoreVisual = () => {
   const breakdowns = [
      { name: 'Schedule Risk', score: 85, color: '#ef4444' },
      { name: 'Budget Risk', score: 60, color: '#f97316' },
      { name: 'Team Risk', score: 45, color: '#facc15' },
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
          <Activity size={16} />
          <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">AI Risk Output matrix</span>
        </div>
        <Fingerprint size={16} className="opacity-30" />
      </div>

      <div className="flex flex-col items-center mb-10">
         <div className="text-[72px] font-black leading-none text-[#ef4444] mb-2 tracking-tighter">72<span className="text-[32px] opacity-40">/100</span></div>
         <span className="mono text-[11px] font-bold uppercase tracking-widest text-[#ef4444] bg-[#ef4444]/10 px-3 py-1 rounded-sm border border-[#ef4444]/20">High Risk Predicted</span>
      </div>

      <div className="flex flex-col gap-6">
        {breakdowns.map((b) => (
          <div key={b.name}>
             <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold opacity-80">{b.name}</span>
                <span className="mono text-[10px] font-bold" style={{ color: b.color }}>{b.score}% Probability</span>
             </div>
             <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.06)' }}>
               <div
                 className="h-full rounded-full transition-all duration-1000"
                 style={{
                   width: `${b.score}%`,
                   background: b.color,
                   boxShadow: `0 0 8px ${b.color}40`,
                 }}
               />
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}


const ProactiveAlertsVisual = () => {
   const alerts = [
      { id: 'EVT-992', title: 'Scope Creep Detected', time: '14 mins ago', severity: 'High', color: '#ef4444' },
      { id: 'EVT-951', title: 'Velocity Dropped 18%', time: '2 hours ago', severity: 'Medium', color: '#f97316' },
      { id: 'EVT-910', title: 'Budget Allocation Drift', time: 'Yesterday', severity: 'Low', color: '#facc15' },
   ];

   return (
      <div className="flex flex-col gap-3 w-full">
         {alerts.map(a => (
            <div
               key={a.id}
               className="rounded-lg p-5 flex items-start gap-4 transition-all hover:bg-white/5"
               style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
               }}
            >
               <div className="mt-1" style={{ color: a.color }}>
                  {a.severity === 'High' ? <ShieldAlert size={18} /> : a.severity === 'Medium' ? <AlertTriangle size={18} /> : <Target size={18} />}
               </div>
               <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-[13px] font-bold">{a.title}</span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                     <span className="mono text-[9px] uppercase opacity-40">{a.id}</span>
                     <span className="mono text-[9px] uppercase opacity-40">{a.time}</span>
                  </div>
               </div>
               <div className="shrink-0 flex items-start">
                  <span
                     className="mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                     style={{ background: `${a.color}15`, color: a.color }}
                  >
                     {a.severity}
                  </span>
               </div>
            </div>
         ))}
      </div>
   )
}


const RiskAssessmentPage: React.FC = () => {
  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Radar size={14} /> Intelligence Model
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Know Your Project's Risk <br className="hidden md:block" /> Before It Knows You.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            IntelliPM's machine learning engine analyzes your project's structure 
            and predicts risk before problems surface. Not gut feel — actual math.
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
            tag="Real Machine Learning"
            heading="Powered by a Real Machine Learning Model"
            body={
              <p>
                The risk engine takes in project data — team size, budget, timeline length, 
                and task complexity — and runs it through a trained predictive model that 
                outputs a concrete risk score and breakdown. It mathematically identifies 
                the most likely failure points so you can act early.
              </p>
            }
            visual={<MLInputsVisual />}
          />

          <Section
            tag="Risk Quantification"
            heading="A Clear Risk Score, Not a Vague Warning"
            body={
              <p>
                Every project receives an analytical risk score from 0-100. The system also 
                breaks down which dimension is driving the risk — is it the timeline? 
                The team size? The budget? Managers see exactly where the problem is 
                originating so they know exactly what lever to pull to fix it.
              </p>
            }
            visual={<RiskScoreVisual />}
            reversed
          />
          
          <Section
            tag="Early Warning System"
            heading="Catch Problems 14 Days Early"
            body={
              <p>
                The system continuously monitors the project's vector trajectory. When 
                drift is detected — tasks falling behind, scope creeping, velocity 
                dropping — proactive alerts are automatically sent to the project manager 
                well before the foundational deadline is in danger.
              </p>
            }
            visual={<ProactiveAlertsVisual />}
          />
        </div>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Stop Reacting. Start Predicting.</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Take control of your infrastructure with mathematically sound forecasting.
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

export default RiskAssessmentPage;
