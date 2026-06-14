import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { Mail, GraduationCap, Code, MessageSquare } from 'lucide-react';

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

const ContactFormVisual = () => {
   return (
      <div 
         className="w-full glass-panel p-8 relative overflow-hidden"
      >
         <h3 className="text-xl font-bold mb-6">Send a Message</h3>
         <form className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                  <label className="mono text-[10px] uppercase opacity-50 mb-1 block">Name</label>
                  <input type="text" className="w-full glass-input rounded-sm px-4 py-2.5 text-[14px]" placeholder="John Doe" />
               </div>
               <div>
                  <label className="mono text-[10px] uppercase opacity-50 mb-1 block">Email</label>
                  <input type="email" className="w-full glass-input rounded-sm px-4 py-2.5 text-[14px]" placeholder="john@example.com" />
               </div>
            </div>
            <div>
               <label className="mono text-[10px] uppercase opacity-50 mb-1 block">Subject</label>
               <input type="text" className="w-full glass-input rounded-sm px-4 py-2.5 text-[14px]" placeholder="How can we help?" />
            </div>
            <div>
               <label className="mono text-[10px] uppercase opacity-50 mb-1 block">Message</label>
               <textarea rows={4} className="w-full glass-input rounded-sm px-4 py-2.5 text-[14px] resize-none" placeholder="Your message here..."></textarea>
            </div>
            <button type="button" className="mt-2 w-full bg-[var(--accent)] text-black font-bold uppercase tracking-widest text-[11px] py-3.5 rounded-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]">
               Send Message
            </button>
         </form>
      </div>
   )
}

const ContactInfoVisual = () => {
   return (
      <div className="w-full flex flex-col gap-6 p-8">
         <div className="flex flex-col gap-2 mb-4">
            <h3 className="text-2xl font-bold">Contact Information</h3>
            <p className="text-[14px] opacity-60 leading-relaxed">
               IntelliPM is a student-built project. We read every single message and appreciate any feedback or inquiries you have.
            </p>
         </div>

         <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/5 text-white flex items-center justify-center shrink-0">
                  <GraduationCap size={18} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[13px] font-bold">Hitec University Taxila</span>
                  <span className="text-[12px] opacity-50">Department of Software Engineering</span>
                  <span className="mono text-[10px] uppercase opacity-40 mt-1">Batch 2022</span>
               </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                  <Mail size={18} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[13px] font-bold">Email Us</span>
                  <a href="mailto:intellipm.dev@gmail.com" className="text-[12px] opacity-70 hover:text-[var(--accent)] transition-colors">intellipm.dev@gmail.com</a>
               </div>
            </div>

            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-white/5 text-white flex items-center justify-center shrink-0">
                  <Code size={18} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[13px] font-bold">GitHub Repository</span>
                  <a href="#" className="text-[12px] opacity-70 hover:text-[var(--accent)] transition-colors">github.com/intellipm</a>
               </div>
            </div>
         </div>
         
         <div className="mt-auto p-4 glass-panel italic text-[11px] opacity-50">
            "This is a final year project. We read every message."
         </div>
      </div>
   )
}


const ContactPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)] min-h-screen">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <MessageSquare size={14} /> Contact
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Get in Touch
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Questions about IntelliPM? Feedback? We'd genuinely love to hear from you.
          </p>
        </section>

        {/* SECTION */}
        <section
           ref={ref}
           className="w-full px-6 md:px-12 lg:px-20 pb-32 max-w-6xl mx-auto"
           style={{
             opacity: visible ? 1 : 0,
             transform: visible ? 'translateY(0)' : 'translateY(40px)',
             transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
           }}
        >
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
               <ContactFormVisual />
               <ContactInfoVisual />
           </div>
        </section>

      </div>
    </main>
  );
};

export default ContactPage;
