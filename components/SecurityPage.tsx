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

const SecurityPage: React.FC = () => {
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
            Security
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
                    <h2 className="text-2xl font-bold mb-3">1. Our Approach</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Security is a core architectural pillar of IntelliPM. Despite being a university project, 
                       we have implemented industry-standard security protocols across the entire stack.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">2. Row-Level Security</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       All database access is protected by Supabase Row-Level Security (RLS) policies. 
                       This ensures that users can only fetch, view, or mutate data they are explicitly 
                       authorized to access, preventing cross-tenant data leakage.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">3. Authentication</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Authentication is powered by Supabase Auth, utilizing secure email/password flows. 
                       We do not store passwords in plaintext under any circumstances.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">4. Role-Based Access Control</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       IntelliPM enforces Role-Based Access Control (RBAC) consisting of three distinct roles: 
                       <span className="font-bold text-[var(--accent)]"> Admin, Project Manager, </span> and 
                       <span className="font-bold text-[var(--accent)]"> Team Member</span>. 
                       Permissions are strictly enforced both on the client UI and the backend database layer.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">5. Audit Logging</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Every destructive or structural action taken in the system is permanently logged with its 
                       before/after state, ensuring a comprehensive paper trail against malicious activity.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">6. Responsible Disclosure</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       If you discover a security vulnerability in IntelliPM, we ask that you practice 
                       responsible disclosure by contacting us directly before making it public: <br/>
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

export default SecurityPage;
