import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { ArrowRight, Mail, Compass } from 'lucide-react';

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

const CareersPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)] min-h-screen">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Compass size={14} /> Open Roles
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            We're Not Hiring. <br className="hidden md:block"/> But We're Open to Conversations.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            IntelliPM is currently a university final year project. We're not a company yet — 
            but we'd love to hear from people who share our vision.
          </p>
        </section>

        {/* SECTION */}
        <section
           ref={ref}
           className="w-full px-6 md:px-12 lg:px-20 py-24 mb-32 border-t border-white/5"
           style={{
             opacity: visible ? 1 : 0,
             transform: visible ? 'translateY(0)' : 'translateY(40px)',
             transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
           }}
        >
           <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center">
               <h2 className="text-3xl md:text-4xl lg:text-[2.6rem] font-black leading-[1.1] tracking-tight mb-4 text-[var(--text-primary)]">
                  What We're Building Toward
               </h2>
               <div className="mb-8 w-12 h-1 bg-[var(--accent)] rounded-sm" />
               
               <p className="text-base md:text-lg leading-relaxed opacity-70 mb-12">
                  We're building IntelliPM as a genuinely usable product, not just an academic exercise. 
                  If you're a developer, designer, or product thinker who is excited about AI-native tools 
                  for engineering teams, reach out. We may not have a job posting, but we're always open 
                  to collaborators.
               </p>
               
               <div className="flex flex-col md:flex-row items-center gap-4 p-8 rounded-lg w-full max-w-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                     <Mail size={20} />
                  </div>
                  <div className="flex flex-col items-start min-w-0 flex-grow w-full text-center md:text-left">
                     <span className="text-[14px] font-bold truncate">intellipm.dev@gmail.com</span>
                     <span className="mono text-[10px] uppercase opacity-50">Drop us a line</span>
                  </div>
                  <a href="mailto:intellipm.dev@gmail.com" className="shrink-0 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest bg-white/10 px-5 py-2.5 rounded hover:bg-white/20 transition-all">
                     Get in Touch
                  </a>
               </div>
           </div>
        </section>

      </div>
    </main>
  );
};

export default CareersPage;
