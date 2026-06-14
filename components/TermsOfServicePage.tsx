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

const TermsOfServicePage: React.FC = () => {
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
            Terms of Service
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
                    <h2 className="text-2xl font-bold mb-3">1. Acceptance of Terms</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       By accessing or using IntelliPM, you agree to be bound by these Terms of Service. 
                       If you do not agree, please do not use the platform.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">2. Use of the Platform</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70 text-[var(--accent)] font-bold">
                       IntelliPM is provided strictly as-is as a final year academic project.
                    </p>
                    <p className="text-[16px] leading-relaxed opacity-70 mt-2">
                       While we strive for high availability and reliability, the service makes no 
                       guarantees regarding uptime or continuous operation.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">3. User Accounts</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       You are solely responsible for maintaining the security of your account and password. 
                       IntelliPM cannot and will not be liable for any loss or damage from your failure to 
                       comply with this security obligation.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">4. Prohibited Use</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       You agree not to use the service for any illegal activities, unauthorized access attempts, 
                       or abuse of the system resources. Any violation may result in immediate account termination.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">5. Intellectual Property</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       All original code, designs, algorithms, and models belong exclusively to the 
                       IntelliPM team (Mohammad Faizan Malik, Harram Hashmi, Izza Malik). You may not copy, 
                       modify, or distribute the software without explicit permission.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">6. Limitation of Liability</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Because this is an academic project, it is provided strictly without warranty of any kind, 
                       express or implied. The developers shall not be held liable for any damages or data 
                       loss arising from the use of this software.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">7. Contact</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       For any terms-related inquiries: <br/>
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

export default TermsOfServicePage;
