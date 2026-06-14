import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, GripVertical, Clock, CheckCircle2,
  Calendar, Flag, User, AlertCircle, FileText, 
  Map, MonitorPlay, Beaker, Rocket
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


const KanbanVisual = () => {
  const columns = [
    {
      title: 'To Do',
      color: 'rgba(255,255,255,0.25)',
      tasks: [
        { name: 'Setup database schema', priority: 'High', date: 'Oct 12' },
        { name: 'Design API endpoints', priority: 'Medium', date: 'Oct 14' },
      ],
    },
    {
      title: 'In Progress',
      color: 'var(--accent)',
      tasks: [
        { name: 'Integrate auth provider', priority: 'Critical', date: 'Oct 10' },
        { name: 'Build dashboard layout', priority: 'High', date: 'Oct 11' },
      ],
    },
    {
      title: 'Review',
      color: '#facc15',
      tasks: [
        { name: 'Update user profile UI', priority: 'Medium', date: 'Oct 09' },
      ],
    },
    {
      title: 'Completed',
      color: '#22c55e',
      tasks: [
        { name: 'Initialize Git repo', priority: 'Low', date: 'Oct 08' },
        { name: 'Project kick-off meeting', priority: 'Medium', date: 'Oct 08' },
      ],
    },
  ];

  const pColor = (p: string) =>
    p === 'Critical' ? '#ef4444' : p === 'High' ? '#f59e0b' : p === 'Medium' ? '#3b82f6' : '#6b7280';

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="grid grid-cols-4 gap-3">
        {columns.map((col) => (
          <div key={col.title}>
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="mono text-[10px] font-bold uppercase tracking-wider" style={{ opacity: 0.5 }}>{col.title}</span>
            </div>
            <div className="flex flex-col gap-2">
              {col.tasks.map((t, i) => (
                <div
                  key={i}
                  className="rounded-md p-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <GripVertical size={12} style={{ opacity: 0.2 }} />
                    <span
                      className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${pColor(t.priority)}20`, color: pColor(t.priority) }}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold leading-snug mb-3" style={{ opacity: 0.8 }}>{t.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[8px] uppercase flex items-center gap-1" style={{ opacity: 0.4 }}>
                      <Clock size={8} /> {t.date}
                    </span>
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">A</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const ListViewVisual = () => {
  const rows = [
    { name: 'Implement RESTful API endpoints', phase: 'Development', priority: 'High', assignee: 'Alex R.', date: 'Nov 01' },
    { name: 'Database schema migration', phase: 'Planning', priority: 'Critical', assignee: 'Sarah C.', date: 'Oct 28' },
    { name: 'Unit testing for auth module', phase: 'Testing', priority: 'Medium', assignee: 'Jordan L.', date: 'Nov 04' },
    { name: 'Review system architecture', phase: 'Planning', priority: 'Medium', assignee: 'Alex R.', date: 'Oct 30' },
    { name: 'Deploy microservices to staging', phase: 'Deployment', priority: 'High', assignee: 'Jordan L.', date: 'Nov 06' },
  ];

  const pColor = (p: string) => p === 'Critical' ? '#ef4444' : p === 'High' ? '#f59e0b' : '#3b82f6';
  
  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/5 mono text-[10px] font-bold uppercase tracking-widest opacity-50">
        <div className="col-span-4">Task Name</div>
        <div className="col-span-3">Phase</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-2">Assignee</div>
        <div className="col-span-1 text-right">Due</div>
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 items-center hover:bg-white/5 transition-colors">
            <div className="col-span-4 text-[12px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{r.name}</div>
            <div className="col-span-3">
              <span className="mono text-[9px] uppercase px-2 py-1 rounded-sm bg-white/5">
                {r.phase}
              </span>
            </div>
            <div className="col-span-2">
              <span
                className="mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                style={{ background: `${pColor(r.priority)}15`, color: pColor(r.priority) }}
              >
                {r.priority}
              </span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">{r.assignee[0]}</div>
              <span className="text-[11px] opacity-70">{r.assignee}</span>
            </div>
            <div className="col-span-1 text-right mono text-[10px] opacity-50">{r.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
};


const TaskDetailVisual = () => {
  return (
    <div
      className="w-full max-w-sm ml-auto rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="p-5 border-b border-white/5 flex items-start justify-between bg-white/5">
        <div>
          <span className="mono text-[10px] tracking-widest uppercase opacity-40 mb-1 block">Task-402</span>
          <h3 className="text-[16px] font-bold leading-tight">Implement rate limiting middleware</h3>
        </div>
        <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-[#f59e0b] text-[#000] font-bold text-[12px]">P</div>
      </div>
      
      <div className="p-6 flex flex-col gap-5 flex-grow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mono text-[9px] uppercase opacity-40 block mb-1">Status</span>
            <span className="text-[11px] font-semibold bg-[var(--accent)] text-black px-2 py-1 rounded-sm">In Progress</span>
          </div>
          <div>
            <span className="mono text-[9px] uppercase opacity-40 block mb-1">Priority</span>
            <span className="text-[11px] font-semibold bg-[#ef4444] text-white px-2 py-1 rounded-sm flex items-center gap-1 w-fit"><AlertCircle size={10} /> Critical</span>
          </div>
          <div>
            <span className="mono text-[9px] uppercase opacity-40 block mb-1">Due Date</span>
            <span className="text-[11px] font-medium flex items-center gap-1 opacity-80"><Calendar size={12} /> Dec 14, 2026</span>
          </div>
          <div>
            <span className="mono text-[9px] uppercase opacity-40 block mb-1">Category</span>
            <span className="text-[11px] font-medium flex items-center gap-1 opacity-80"><FileText size={12} /> Security</span>
          </div>
        </div>

        <div>
          <span className="mono text-[9px] uppercase opacity-40 block mb-2">Description</span>
          <p className="text-[12px] opacity-70 leading-relaxed">
            We need to implement a Redis-based rate limiting middleware on the public API routes to prevent abuse. Limit should be configurable per route but default to 100 req/min per IP.
          </p>
        </div>
      </div>
    </div>
  );
};


const PhasesVisual = () => {
  const phases = [
    { name: 'Planning', icon: <Map size={20} />, desc: 'Research, requirements, and architecture design.', color: '#3b82f6' },
    { name: 'Development', icon: <MonitorPlay size={20} />, desc: 'Active coding and implementation of features.', color: '#a855f7' },
    { name: 'Testing', icon: <Beaker size={20} />, desc: 'QA, unit tests, and performance validation.', color: '#f59e0b' },
    { name: 'Deployment', icon: <Rocket size={20} />, desc: 'Releasing to staging and production environments.', color: '#22c55e' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 w-full">
      {phases.map((p, i) => (
        <div
          key={i}
          className="rounded-lg p-5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="mb-4" style={{ color: p.color }}>{p.icon}</div>
          <h4 className="text-[14px] font-bold mb-2 uppercase tracking-wide">{p.name}</h4>
          <p className="text-[11px] opacity-60 leading-relaxed">{p.desc}</p>
        </div>
      ))}
    </div>
  );
};


const TaskManagementPage: React.FC = () => {
  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <CheckCircle2 size={14} /> Core Feature
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Task Management Built<br/>for Engineering Teams
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            From backlog to done — track every task, in every phase, 
            across every project. No spreadsheets. No chaos.
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
        <div className="w-full flex flex-col gap-0 pb-24">
          <Section
            tag="Visual Workflow"
            heading="Visualize Work the Way Your Team Thinks"
            body={
              <p>
                Tasks are organized into a responsive, drag-and-drop Kanban board 
                with standard columns: To Do, In Progress, Review, and Completed. 
                Managers can move tasks between stages instantly. Every card shows the 
                assignee, priority, and due date at a glance so everyone knows exactly 
                what needs attention now.
              </p>
            }
            visual={<KanbanVisual />}
          />

          <Section
            tag="Data-Dense Interface"
            heading="Prefer a Spreadsheet? We've Got That Too."
            body={
              <p>
                For power users, our List View provides a dense, sortable, and 
                filterable table of all tasks. Group tasks by project phase, sort by 
                priority level, or filter by due date and assignee. Review hundreds of 
                tasks rapidly without losing context.
              </p>
            }
            visual={<ListViewVisual />}
            reversed
          />

          <Section
            tag="Comprehensive Records"
            heading="Every Task, Fully Documented"
            body={
              <p>
                A task isn't just a sticky note. Each task opens into a full detail 
                drawer containing the title, rich text description, category, priority level 
                (Critical / High / Medium / Low), due date, assignee, and status. 
                Changes are saved instantly and logged automatically in the audit trail.
              </p>
            }
            visual={<TaskDetailVisual />}
          />

          <Section
            tag="Project Structure"
            heading="Organize by Phase, Not Just Status"
            body={
              <p>
                Status tells you what's happening now; phases tell you where the 
                project stands overall. Tasks belong to project phases like Planning, 
                Development, Testing, and Deployment — giving managers a true macro 
                view of progress and preventing downstream bottlenecks.
              </p>
            }
            visual={<PhasesVisual />}
            reversed
          />
        </div>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Ready to Bring Order to Your Projects?</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Give your engineering team the structured, intelligent tooling they deserve. Start managing tasks with IntelliPM today.
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

export default TaskManagementPage;
