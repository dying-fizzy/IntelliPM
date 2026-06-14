import React, { useEffect, useRef, useState } from 'react';
import NeuralBackground from './NeuralBackground';
import { Shield } from 'lucide-react';

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

const CookiePolicyPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)] min-h-screen">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 w-full text-center max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Shield size={14} /> Legal
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-6 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Cookie Policy
          </h1>
          <p className="mono uppercase opacity-40 text-sm font-bold tracking-widest">
            Last updated: April 2026
          </p>
        </section>

        {/* CONTENT SECTION */}
        <section
           ref={ref}
           className="w-full px-6 md:px-12 py-16 max-w-4xl mx-auto pb-40"
           style={{
             opacity: visible ? 1 : 0,
             transform: visible ? 'translateY(0)' : 'translateY(40px)',
             transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
           }}
        >
           <div 
             className="w-full rounded-lg p-8 md:p-12 text-left"
             style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
             }}
           >
              <div className="space-y-12">
                 
                 <div>
                    <h2 className="text-2xl font-bold mb-3">1. What Are Cookies</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Cookies are small text files stored on your device that help web applications 
                       remember state and user information. IntelliPM uses a minimal amount of cookies, 
                       exclusively for functional purposes. We do not use marketing or tracking cookies.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">2. Cookies We Use</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       We use <strong>session cookies</strong> to maintain your authenticated state while navigating 
                       the app, and <strong>preference cookies</strong> to remember your UI choices 
                       (such as dark/light mode configurations).
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">3. Third-Party Cookies</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Our authentication backend, Supabase, utilizes cookies strictly for secure session 
                       management and CSRF token propagation. These are necessary for the application to function.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">4. Managing Cookies</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       You can manage or clear cookies at any time via your browser settings. However, 
                       disabling cookies entirely will prevent you from logging into IntelliPM.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">5. Contact</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       For questions about our cookie usage: <br/>
                       <a href="mailto:intellipm.dev@gmail.com" className="text-[var(--accent)] underline mt-2 inline-block">intellipm.dev@gmail.com</a>
                    </p>
                 </div>

              </div>
           </div>
        </section>

      </div>
    </main>
  );
};

export default CookiePolicyPage;
