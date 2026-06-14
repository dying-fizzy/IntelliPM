import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { ArrowRight, BookOpen } from 'lucide-react';

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

const BlogCardsVisual = () => {
   const posts = [
      { 
         title: 'Why Traditional Project Management Tools Are Failing Engineering Teams',
         date: 'March 2026',
         excerpt: 'A short exploration into how reactive tools create reactive teams. When your board is just a digital whiteboard, you miss the power of compute.',
         tag: 'OPINION',
         color: 'var(--accent)'
      },
      { 
         title: 'How We Built the Smart Assign Algorithm',
         date: 'February 2026',
         excerpt: 'A deep dive into our skill matching and workload balancing logic. How we calculate availability dynamically to avoid burnout.',
         tag: 'TECHNICAL',
         color: '#3b82f6'
      },
      { 
         title: 'Predicting Project Risk with Machine Learning: Our Approach',
         date: 'January 2026',
         excerpt: 'Breaking down the ML microservice. How we mapped project trajectory data to predict scope creep before it happens.',
         tag: 'TECHNICAL',
         color: '#3b82f6'
      },
   ];
   
   return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
         {posts.map((post, i) => (
            <div
               key={i}
               className="rounded-lg p-8 flex flex-col items-start transition-all duration-300 hover:-translate-y-2 group"
               style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
               }}
            >
               <span 
                  className="mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm mb-5"
                  style={{ background: `${post.color}15`, color: post.color }}
               >
                  {post.tag}
               </span>
               <span className="mono text-[10px] uppercase opacity-40 mb-3 block">{post.date}</span>
               <h3 className="text-xl font-bold mb-4 leading-snug group-hover:text-[var(--accent)] transition-colors">{post.title}</h3>
               <p className="text-[13px] leading-relaxed opacity-60 mb-8 flex-grow">
                  {post.excerpt}
               </p>
               <a href="#" className="mt-auto inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest hover:text-[var(--accent)] transition-colors">
                  Read More <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
               </a>
            </div>
         ))}
      </div>
   )
}


const BlogPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)] min-h-screen">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <BookOpen size={14} /> Insights
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Thoughts on AI, Teams, <br className="hidden md:block"/> and Better Project Management
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            We write about what we're learning while building IntelliPM.
          </p>
        </section>

        {/* SECTION */}
        <section
           ref={ref}
           className="w-full px-6 md:px-12 lg:px-20 pb-32"
           style={{
             opacity: visible ? 1 : 0,
             transform: visible ? 'translateY(0)' : 'translateY(40px)',
             transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
           }}
        >
           <BlogCardsVisual />
        </section>

      </div>
    </main>
  );
};

export default BlogPage;
