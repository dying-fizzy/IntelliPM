import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, Zap, Edit3, MessageSquare, Settings2, Sparkles, CheckCircle2, FileText, Database, Shield, Monitor, CheckCircle, BrainCircuit
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
    { num: '01', title: 'Describe Your Feature', icon: <MessageSquare size={24} />, desc: 'Type a plain English description. Example: "Build a user authentication system with email and Google OAuth."' },
    { num: '02', title: 'Set Parameters', icon: <Settings2 size={24} />, desc: 'Choose the complexity level (Simple / Medium / Complex) and project type.' },
    { num: '03', title: 'AI Generates Your Sprint', icon: <Zap size={24} />, desc: 'Receive a full list of granular tasks with titles, priority levels, categories, and suggested deadlines.' },
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


const LiveDemoVisual = () => {
  const tasks = [
    { name: 'Set up Supabase Auth configuration', priority: 'High', pColor: '#f59e0b', cat: 'Backend', icon: <Database size={10} /> },
    { name: 'Build login page UI', priority: 'High', pColor: '#f59e0b', cat: 'Frontend', icon: <Monitor size={10} /> },
    { name: 'Implement Google OAuth flow', priority: 'Critical', pColor: '#ef4444', cat: 'Backend', icon: <Database size={10} /> },
    { name: 'Create protected route middleware', priority: 'Medium', pColor: '#3b82f6', cat: 'Backend', icon: <Database size={10} /> },
    { name: 'Write auth unit tests', priority: 'Medium', pColor: '#3b82f6', cat: 'QA', icon: <CheckCircle size={10} /> },
  ];

  return (
    <div
      className="w-full grid grid-cols-1 md:grid-cols-5 rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="col-span-2 p-6 flex flex-col justify-center border-r border-white/5 bg-white/5">
         <div className="flex items-center gap-2 mb-4">
            <Zap size={14} style={{ color: 'var(--accent)' }}/>
            <span className="mono text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>Generator Setup</span>
         </div>
         
         <div className="flex flex-col gap-4">
            <div>
               <span className="mono text-[9px] uppercase opacity-40 mb-1 block">Context Input</span>
               <div className="rounded border border-white/10 bg-black/20 p-3 text-[12px] opacity-80 leading-relaxed min-h-[80px]">
                  Build a user authentication system with email and Google OAuth.
                  <span className="inline-block w-1 h-3 ml-1 bg-[var(--accent)] animate-pulse"></span>
               </div>
            </div>
            
            <div>
               <span className="mono text-[9px] uppercase opacity-40 mb-1 block">Complexity</span>
               <div className="flex gap-2">
                 <span className="border border-white/10 rounded px-3 py-1.5 text-[11px] opacity-40">Simple</span>
                 <span className="border border-[var(--accent)] rounded px-3 py-1.5 text-[11px] text-[var(--accent)] bg-[var(--accent)]/10 font-bold">Medium</span>
                 <span className="border border-white/10 rounded px-3 py-1.5 text-[11px] opacity-40">Complex</span>
               </div>
            </div>
            
            <button className="mt-4 w-full bg-[var(--accent)] text-black font-bold uppercase tracking-wider text-[11px] py-3 rounded flex justify-center items-center gap-2 hover:brightness-110">
               <Sparkles size={14} /> Generate Tasks
            </button>
         </div>
      </div>
      
      <div className="col-span-3 p-6 flex flex-col">
         <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
            <span className="mono text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">Output List</span>
            <span className="mono text-[9px] uppercase opacity-40 bg-white/10 px-2 py-0.5 rounded-sm">5 Tasks Generated</span>
         </div>
         
         <div className="flex flex-col gap-3">
            {tasks.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md p-3"
                 style={{
                   background: 'rgba(255,255,255,0.02)',
                   border: '1px solid rgba(255,255,255,0.05)',
                 }}
              >
                  <CheckCircle2 size={14} style={{ color: 'var(--accent)', opacity: 0.5, flexShrink: 0 }} />
                  <span className="text-[11px] font-semibold flex-grow" style={{ opacity: 0.8 }}>{t.name}</span>
                  <span
                    className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{ background: `${t.pColor}15`, color: t.pColor }}
                  >
                    {t.priority}
                  </span>
                  <span className="mono text-[9px] px-2 py-0.5 rounded flex items-center gap-1 opacity-50 bg-white/5 whitespace-nowrap">
                    {t.icon} {t.cat}
                  </span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};


const BenefitCardsVisual = () => {
   const benefits = [
      {
         title: "No More Blank Backlogs",
         icon: <FileText size={20} />,
         desc: "Start every sprint with a fully populated task list instead of staring at an empty board. Jump straight into execution."
      },
      {
         title: "AI Thinks in Detail",
         icon: <BrainCircuit size={20} />,
         desc: "The AI acts as a senior engineer, breaking down features into granular sub-tasks so no edge case gets missed."
      },
      {
         title: "Fully Editable",
         icon: <Edit3 size={20} />,
         desc: "Every generated task can be edited, reassigned, or deleted. AI gives you the starting point, you stay in control."
      }
   ];
   
   return (
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto">
         {benefits.map((b, i) => (
            <div
               key={i}
               className="rounded-lg p-6 bg-white/5 border border-white/5 flex flex-col gap-4 text-left transition-all hover:border-white/10"
            >
               <div className="w-10 h-10 rounded bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                  {b.icon}
               </div>
               <h3 className="font-bold text-lg">{b.title}</h3>
               <p className="text-[13px] leading-relaxed opacity-60">
                 {b.desc}
               </p>
            </div>
         ))}
       </div>
   )
}


const AITaskGenerationPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Zap size={14} /> AI Accelerator
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Describe a Feature. <br className="hidden md:block" /> Get a Full Sprint Instantly.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Stop spending hours writing task lists manually. Type what you want to build, 
            and IntelliPM's AI generates a complete, prioritized task breakdown in seconds.
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
                Three Steps to a Perfect Sprint
             </h2>
             <div className="mx-auto w-12 h-1 bg-[var(--accent)] rounded-sm"></div>
           </div>
           
           <HowItWorksVisual />
        </section>

        {/* FEATURE SECTIONS */}
        <div className="w-full flex flex-col gap-0 pb-24 border-t border-white/5">
          <Section
            tag="Live Demo Sandbox"
            heading="See It in Action"
            body={
              <p>
                Watch how a single sentence turns into actionable items. 
                Our underlying language models understand standard engineering paradigms, 
                frameworks, and best practices. It infers prerequisites, splits frontend 
                from backend work, and flags necessary QA steps automatically.
              </p>
            }
            visual={<LiveDemoVisual />}
          />
        </div>
        
        {/* WHY IT MATTERS */}
        <section className="w-full px-6 md:px-12 lg:px-20 py-32 border-t border-white/5 bg-white/[0.01]">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl lg:text-[2.8rem] font-black leading-[1.1] tracking-tight mb-4 text-[var(--text-primary)]">
                Hours of Planning. <span style={{ color: 'var(--accent)' }}>Done in Seconds.</span>
             </h2>
             <p className="opacity-60 text-lg mx-auto max-w-xl mb-8">
               Reclaim your time as a project manager and let the intelligence engine handle the scaffolding.
             </p>
           </div>
           
           <BenefitCardsVisual />
        </section>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Your Next Sprint is One Prompt Away.</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Experience the future of agile planning. Skip the tedious breakdown process.
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

export default AITaskGenerationPage;
