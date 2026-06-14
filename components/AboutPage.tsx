import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { ArrowRight, Users, GraduationCap, Compass } from 'lucide-react';

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

const Section: React.FC<{ heading: string; body?: React.ReactNode; children?: React.ReactNode }> = ({ heading, body, children }) => {
  const { ref, visible } = useInView(0.12);

  return (
    <section
      ref={ref}
      className="w-full px-6 md:px-12 lg:px-20 py-24 border-t border-white/5"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
         <h2 className="text-3xl md:text-4xl lg:text-[2.6rem] font-black leading-[1.1] tracking-tight mb-4 text-[var(--text-primary)] text-center">
            {heading}
         </h2>
         <div className="mb-12 w-12 h-1 bg-[var(--accent)] rounded-sm" />
         
         {body && (
            <div className="text-base md:text-lg leading-relaxed text-center opacity-70 max-w-3xl mb-12">
               {body}
            </div>
         )}
         
         {children && <div className="w-full">{children}</div>}
      </div>
    </section>
  );
};


const TeamMemberVisual = () => {
   const team = [
      { name: 'Mohammad Faizan Malik', init: 'MF', title: 'Software Engineering', uni: 'Hitec University Taxila' },
      { name: 'Harram Hashmi', init: 'HH', title: 'Software Engineering', uni: 'Hitec University Taxila' },
      { name: 'Izza Malik', init: 'IM', title: 'Software Engineering', uni: 'Hitec University Taxila' },
   ];
   
   return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto mt-4">
         {team.map((member, i) => (
            <div
               key={i}
               className="rounded-lg p-6 flex flex-col items-center text-center transition-all hover:-translate-y-1"
               style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderBottom: '2px solid var(--accent)',
                  backdropFilter: 'blur(12px)',
               }}
            >
               <div className="w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl mb-5 text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                  {member.init}
               </div>
               <h3 className="text-[16px] font-bold mb-1">{member.name}</h3>
               <span className="mono text-[10px] uppercase opacity-50 mb-2">{member.title}</span>
               <span className="text-[12px] opacity-40">{member.uni}</span>
            </div>
         ))}
      </div>
   )
}


const AboutPage: React.FC = () => {
  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)] min-h-screen">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <Users size={14} /> The Team
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Built by Engineers, <br className="hidden md:block" /> for Engineering Teams
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            IntelliPM was born out of a simple frustration: project management tools 
            were too dumb, too manual, and too slow. We built something smarter.
          </p>
        </section>

        {/* OUR STORY */}
        <Section
           heading="Where IntelliPM Comes From"
           body={
             <>
               <p className="mb-4">
                  IntelliPM is a final year project developed by students of the Software Engineering 
                  Department at Hitec University Taxila, Batch 2022. It was built to solve a real problem: 
                  modern engineering teams deserve a project management tool that thinks alongside them, 
                  not one that just tracks spreadsheets.
               </p>
               <p>
                  The platform combines a full-stack web application (React, Node.js, Supabase) with a 
                  machine learning microservice and a generative AI layer to deliver genuinely 
                  intelligent project management.
               </p>
             </>
           }
        />

        {/* THE TEAM */}
        <Section
           heading="The People Behind IntelliPM"
        >
           <TeamMemberVisual />
        </Section>

        {/* OUR MISSION */}
        <Section
           heading="What We're Trying to Do"
           body={
               <p>
                  We believe project management should be proactive, not reactive. IntelliPM is our 
                  answer to tools that tell you what went wrong after it's already too late. We built a 
                  system that sees problems coming and helps teams move faster, smarter, and without burning out.
               </p>
           }
        />
        
      </div>
    </main>
  );
};

export default AboutPage;
