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

const PrivacyPolicyPage: React.FC = () => {
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
            Privacy Policy
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
                    <h2 className="text-2xl font-bold mb-3">1. Information We Collect</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       We collect information necessary to provide you with the IntelliPM service. 
                       This includes your account information (name, email), usage data, and the 
                       project data you input into the system.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">2. How We Use Your Information</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       The data we collect is used exclusively to provide the service, run our intelligent 
                       features (like Smart Assign and Risk Assessment), improve the platform, and send 
                       you important account notifications.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">3. Data Storage</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       Your data is stored securely using Supabase (PostgreSQL). We strictly enforce 
                       Row-Level Security (RLS) ensuring that data can only be accessed by authorized 
                       users within your organization.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">4. Data Sharing</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70 font-bold text-[var(--accent)]">
                       We do not sell your data. Period.
                    </p>
                    <p className="text-[16px] leading-relaxed opacity-70 mt-2">
                       We only share data with essential third-party service providers (like our hosting provider) 
                       required to operate the platform.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">5. Your Rights</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       You maintain full ownership of your data. You can request the permanent deletion 
                       of your account and all associated data from our systems at any time.
                    </p>
                 </div>

                 <div>
                    <h2 className="text-2xl font-bold mb-3">6. Contact</h2>
                    <div className="w-8 h-1 bg-[var(--accent)] mb-6 rounded-sm"></div>
                    <p className="text-[16px] leading-relaxed opacity-70">
                       If you have any questions regarding this privacy policy, please contact us at: <br/>
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

export default PrivacyPolicyPage;
