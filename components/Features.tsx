
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import {
  ChevronRight,
  Sparkles,
  GripVertical,
  User,
  Star,
  Zap,
  Clock,
  AlertTriangle,
  Info,
  ShieldAlert,
  Shield,
  Settings,
  Eye,
  ClipboardList,
  Users,
  BarChart3,
  Lock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

/* ───────────────────────────────────────────
   Scroll-triggered fade-in hook
─────────────────────────────────────────── */
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

/* ───────────────────────────────────────────
   Reusable Section wrapper
─────────────────────────────────────────── */
interface SectionProps {
  tag: string;
  heading: string;
  body: React.ReactNode;
  visual: React.ReactNode;
  reversed?: boolean;
  cta?: { label: string; to: string };
}

const Section: React.FC<SectionProps> = ({ tag, heading, body, visual, reversed, cta }) => {
  const { ref, visible } = useInView(0.12);

  return (
    <section
      ref={ref}
      className="w-full px-6 md:px-12 lg:px-20"
      style={{
        paddingTop: '7rem',
        paddingBottom: '7rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.8s cubic-bezier(.22,1,.36,1), transform 0.8s cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div
        className="w-full grid grid-cols-1 lg:grid-cols-2 items-center"
        style={{ gap: '4rem' }}
      >
        {/* Text column */}
        <div className={reversed ? 'lg:order-2' : ''}>
          {/* Monospace tag */}
          <div className="flex items-center gap-3 mb-6">
            <span
              className="mono text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--accent)' }}
            >
              {tag}
            </span>
          </div>

          {/* Heading + green underline accent */}
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

          {/* Body copy */}
          <div
            className="text-base md:text-lg leading-relaxed mb-10"
            style={{ opacity: 0.65, maxWidth: '540px' }}
          >
            {body}
          </div>

          {/* Optional CTA */}
          {cta && (
            <Link
              to={cta.to}
              className="inline-flex items-center gap-2 group text-[12px] font-black uppercase tracking-[0.2em] border px-7 py-3.5 rounded-sm transition-all hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {cta.label}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Visual column */}
        <div className={`w-full flex justify-center ${reversed ? 'lg:order-1' : ''}`}>
          {visual}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════
   1. KANBAN BOARD MOCK
═══════════════════════════════════════════ */
const KanbanMock: React.FC = () => {
  const columns = [
    {
      title: 'To Do',
      color: 'rgba(255,255,255,0.25)',
      tasks: [
        { name: 'Design API schema', priority: 'Medium', cat: 'Backend' },
        { name: 'Write unit tests', priority: 'Low', cat: 'QA' },
      ],
    },
    {
      title: 'In Progress',
      color: 'var(--accent)',
      tasks: [
        { name: 'Build auth flow', priority: 'High', cat: 'Frontend' },
      ],
    },
    {
      title: 'Review',
      color: '#facc15',
      tasks: [
        { name: 'Dashboard layout', priority: 'Medium', cat: 'UI/UX' },
      ],
    },
    {
      title: 'Completed',
      color: '#22c55e',
      tasks: [
        { name: 'DB migration scripts', priority: 'High', cat: 'DevOps' },
      ],
    },
  ];

  const priorityColor = (p: string) =>
    p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#6b7280';

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '20px',
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between mb-5">
        <span className="mono text-[10px] font-bold uppercase tracking-[0.15em]" style={{ opacity: 0.35 }}>
          Project: Authentication Module
        </span>
        <div className="flex items-center gap-2">
          <span className="mono text-[9px] uppercase px-2 py-0.5 rounded-sm" style={{ background: 'var(--accent)', color: '#000', fontWeight: 800 }}>
            Kanban
          </span>
          <span className="mono text-[9px] uppercase px-2 py-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.06)', fontWeight: 700, opacity: 0.4 }}>
            List
          </span>
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-4 gap-3">
        {columns.map((col) => (
          <div key={col.title}>
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="mono text-[10px] font-bold uppercase tracking-wider" style={{ opacity: 0.5 }}>{col.title}</span>
              <span className="mono text-[9px] ml-auto" style={{ opacity: 0.25 }}>{col.tasks.length}</span>
            </div>
            {/* Task cards */}
            <div className="flex flex-col gap-2">
              {col.tasks.map((t) => (
                <div
                  key={t.name}
                  className="rounded-md p-3 group transition-all hover:border-[var(--accent)]/30"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <GripVertical size={10} style={{ opacity: 0.15, marginTop: 2 }} />
                    <span
                      className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${priorityColor(t.priority)}20`, color: priorityColor(t.priority) }}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold leading-snug mb-2" style={{ opacity: 0.8 }}>{t.name}</p>
                  <span className="mono text-[8px] uppercase px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)', opacity: 0.4 }}>{t.cat}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   2. SMART ASSIGN MOCK
═══════════════════════════════════════════ */
const SmartAssignMock: React.FC = () => {
  const members = [
    { name: 'Sarah Chen', role: 'Full-Stack Dev', skills: ['React', 'Node.js', 'PostgreSQL'], match: 'High', matchColor: '#22c55e', workload: 35 },
    { name: 'Alex Rivera', role: 'Backend Engineer', skills: ['Python', 'Django', 'AWS'], match: 'Medium', matchColor: '#f59e0b', workload: 68 },
    { name: 'Jordan Lee', role: 'DevOps Lead', skills: ['Docker', 'CI/CD', 'Terraform'], match: 'Low', matchColor: '#ef4444', workload: 92 },
  ];

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
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
        <span className="mono text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Smart Assign</span>
      </div>
      <p className="text-[11px] mb-5" style={{ opacity: 0.35 }}>
        AI-recommended candidates for: <span className="font-bold" style={{ opacity: 1 }}>"Build authentication flow"</span>
      </p>

      <div className="flex flex-col gap-3">
        {members.map((m, i) => (
          <div
            key={m.name}
            className="rounded-md p-4 flex items-center gap-4 transition-all"
            style={{
              background: i === 0 ? `${m.matchColor}08` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${i === 0 ? `${m.matchColor}25` : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[12px] font-black"
              style={{ background: `${m.matchColor}15`, color: m.matchColor }}
            >
              {m.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* Info */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-bold">{m.name}</span>
                <span className="mono text-[9px] uppercase" style={{ opacity: 0.3 }}>{m.role}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {m.skills.map(s => (
                  <span key={s} className="mono text-[8px] uppercase px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Match badge */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span
                className="mono text-[9px] font-bold uppercase px-2.5 py-1 rounded-sm"
                style={{ background: `${m.matchColor}18`, color: m.matchColor, border: `1px solid ${m.matchColor}30` }}
              >
                {m.match} Match
              </span>
              <span className="mono text-[8px]" style={{ opacity: 0.25 }}>
                Workload: {m.workload}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   3. AI TASK GENERATION MOCK
═══════════════════════════════════════════ */
const TaskGenMock: React.FC = () => {
  const tasks = [
    { name: 'Set up JWT token generation & validation', priority: 'High', deadline: 'Apr 15', cat: 'Backend' },
    { name: 'Create login & registration UI components', priority: 'High', deadline: 'Apr 16', cat: 'Frontend' },
    { name: 'Implement password hashing with bcrypt', priority: 'High', deadline: 'Apr 15', cat: 'Security' },
    { name: 'Build role-based middleware guards', priority: 'Medium', deadline: 'Apr 18', cat: 'Backend' },
    { name: 'Write integration tests for auth endpoints', priority: 'Medium', deadline: 'Apr 20', cat: 'QA' },
  ];

  const priorityColor = (p: string) =>
    p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#6b7280';

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
      {/* Input area */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} style={{ color: 'var(--accent)' }} />
          <span className="mono text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>AI Task Generator</span>
        </div>
        <div
          className="rounded-md p-4 mb-1"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p className="text-[12px] leading-relaxed" style={{ opacity: 0.6 }}>
            "Build a complete authentication system with JWT tokens, login/register pages, password hashing, role-based access, and full test coverage."
          </p>
        </div>
        <span className="mono text-[8px] uppercase" style={{ opacity: 0.2 }}>Feature description</span>
      </div>

      {/* Divider with pulse */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-grow" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <span
          className="mono text-[8px] font-bold uppercase px-2 py-0.5 rounded-sm"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          5 Tasks Generated
        </span>
        <div className="flex-grow" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Generated tasks */}
      <div className="flex flex-col gap-2">
        {tasks.map((t, i) => (
          <div
            key={t.name}
            className="flex items-center gap-3 rounded-md p-3 transition-all"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              animationDelay: `${i * 100}ms`,
            }}
          >
            <CheckCircle2 size={14} style={{ color: 'var(--accent)', opacity: 0.5, flexShrink: 0 }} />
            <span className="text-[11px] font-semibold flex-grow" style={{ opacity: 0.75 }}>{t.name}</span>
            <span
              className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm shrink-0"
              style={{ background: `${priorityColor(t.priority)}15`, color: priorityColor(t.priority) }}
            >
              {t.priority}
            </span>
            <span className="mono text-[8px] shrink-0" style={{ opacity: 0.25 }}>
              <Clock size={8} className="inline mr-1" />{t.deadline}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   4. RESOURCE INTELLIGENCE MOCK
═══════════════════════════════════════════ */
const ResourceMock: React.FC = () => {
  const members = [
    { name: 'Sarah Chen', role: 'Full-Stack Dev', workload: 30, status: 'Available', color: '#22c55e' },
    { name: 'Alex Rivera', role: 'Backend Engineer', workload: 55, status: 'Moderate', color: '#f59e0b' },
    { name: 'Jordan Lee', role: 'DevOps Lead', workload: 88, status: 'Overloaded', color: '#ef4444' },
    { name: 'Maya Patel', role: 'UI Designer', workload: 42, status: 'Available', color: '#22c55e' },
  ];

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
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
        <span className="mono text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Resource Intelligence</span>
      </div>
      <p className="text-[10px] mono uppercase mb-6" style={{ opacity: 0.25 }}>Real-time workload tracking</p>

      <div className="flex flex-col gap-4">
        {members.map((m) => (
          <div key={m.name} className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
              style={{ background: `${m.color}12`, color: m.color }}
            >
              {m.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* Name + bar */}
            <div className="flex-grow min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-bold">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                    style={{ background: `${m.color}15`, color: m.color }}
                  >
                    {m.status}
                  </span>
                  <span className="mono text-[9px] font-bold" style={{ color: m.color }}>{m.workload}%</span>
                </div>
              </div>
              {/* Progress bar */}
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: '6px', background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${m.workload}%`,
                    background: m.color,
                    boxShadow: `0 0 8px ${m.color}40`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   5. AI INSIGHTS MOCK
═══════════════════════════════════════════ */
const InsightsMock: React.FC = () => {
  const insights = [
    {
      type: 'warning',
      icon: <AlertTriangle size={16} />,
      color: '#f59e0b',
      title: 'Deadline Risk Detected',
      msg: '3 tasks are delayed by an average of 4 days. Consider redistributing workload.',
    },
    {
      type: 'critical',
      icon: <ShieldAlert size={16} />,
      color: '#ef4444',
      title: 'Burnout Alert',
      msg: 'Jordan Lee has 7 critical tasks assigned. Immediate rebalancing recommended.',
    },
    {
      type: 'info',
      icon: <Info size={16} />,
      color: 'var(--accent)',
      title: 'Sprint Velocity Update',
      msg: 'Current sprint velocity is 18% above average. Team is ahead of schedule.',
    },
  ];

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
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
        <span className="mono text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent)' }}>AI Insights</span>
      </div>
      <p className="text-[10px] mono uppercase mb-6" style={{ opacity: 0.25 }}>Proactive intelligence feed</p>

      <div className="flex flex-col gap-3">
        {insights.map((ins, i) => (
          <div
            key={i}
            className="rounded-md p-4 flex items-start gap-3 transition-all"
            style={{
              background: `${typeof ins.color === 'string' && ins.color.startsWith('#') ? ins.color : ''}06`,
              border: `1px solid ${typeof ins.color === 'string' && ins.color.startsWith('#') ? `${ins.color}20` : 'rgba(0,255,0,0.12)'}`,
            }}
          >
            {/* Icon */}
            <div
              className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                background: `${typeof ins.color === 'string' && ins.color.startsWith('#') ? ins.color : '#00ff00'}12`,
                color: ins.color,
              }}
            >
              {ins.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-bold">{ins.title}</span>
                <span
                  className="mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: `${typeof ins.color === 'string' && ins.color.startsWith('#') ? ins.color : '#00ff00'}15`,
                    color: ins.color,
                  }}
                >
                  {ins.type}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ opacity: 0.55 }}>{ins.msg}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   6. ROLE-BASED ACCESS MOCK
═══════════════════════════════════════════ */
const RolesMock: React.FC = () => {
  const roles = [
    {
      name: 'Admin',
      icon: <Shield size={24} />,
      color: '#ef4444',
      perms: [
        'Manage all users & roles',
        'Archive or delete projects',
        'View system-wide metrics',
        'Configure AI settings',
        'Access full audit trail',
      ],
    },
    {
      name: 'Project Manager',
      icon: <Settings size={24} />,
      color: 'var(--accent)',
      perms: [
        'Create & manage projects',
        'Assign tasks to members',
        'Use AI Smart Assign',
        'Generate tasks with AI',
        'View resource workloads',
      ],
    },
    {
      name: 'Team Member',
      icon: <Eye size={24} />,
      color: '#3b82f6',
      perms: [
        'View assigned tasks',
        'Update task status',
        'Log work & comments',
        'View personal dashboard',
        'Receive AI suggestions',
      ],
    },
  ];

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
      {roles.map((r) => (
        <div
          key={r.name}
          className="rounded-lg p-6 flex flex-col transition-all hover:scale-[1.02]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-5"
            style={{
              background: `${typeof r.color === 'string' && r.color.startsWith('#') ? r.color : '#00ff00'}12`,
              color: r.color,
            }}
          >
            {r.icon}
          </div>

          <h3
            className="text-lg font-black uppercase tracking-wider mb-1"
            style={{ color: r.color }}
          >
            {r.name}
          </h3>
          <div className="mb-5" style={{ height: '2px', width: '24px', background: r.color, borderRadius: '1px' }} />

          <ul className="flex flex-col gap-2.5 flex-grow">
            {r.perms.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[11px]" style={{ opacity: 0.6 }}>
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" style={{ color: r.color }} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════
   FEATURES — Main Export
═══════════════════════════════════════════ */
const Features: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="w-full overflow-hidden">
      {/* ── 1. Smart Task Management ── */}
      <Section
        tag="Smart Task Management"
        heading="Everything Your Team Needs, In One Place"
        body={
          <p>
            Create projects, break them into tasks, and manage everything with a
            drag-and-drop Kanban board or a powerful list view. Filter by
            priority, sort by deadline, group by phase — your workflow, your
            rules. Everything updates in real time so the whole team stays in
            sync.
          </p>
        }
        visual={<KanbanMock />}
        cta={{ label: 'Get Started', to: '/register' }}
      />

      {/* ── 2. AI-Powered Smart Assign ── */}
      <Section
        tag="AI-Powered Smart Assign"
        heading="The Right Person for Every Task, Automatically"
        body={
          <p>
            Stop guessing who should work on what. When you assign a task, our
            AI analyzes every team member's skills, experience, and current
            workload — then ranks the best candidates with a confidence rating.
            High match, medium match, or low match — you always know why someone
            was recommended.
          </p>
        }
        visual={<SmartAssignMock />}
        reversed
      />

      {/* ── 3. Instant AI Task Generation ── */}
      <Section
        tag="Instant AI Task Generation"
        heading={`Describe It. Let AI Build the Sprint.`}
        body={
          <p>
            Just describe a feature in plain English — like "Build an
            authentication system" — and the AI instantly generates a complete
            list of granular tasks with priorities, categories, and suggested
            deadlines. What used to take an hour of planning now takes seconds.
          </p>
        }
        visual={<TaskGenMock />}
        cta={{ label: 'Try It Free', to: '/register' }}
      />

      {/* ── 4. Resource Intelligence ── */}
      <Section
        tag="Resource Intelligence"
        heading="See Who's Overwhelmed Before It's Too Late"
        body={
          <p>
            Real-time workload tracking for every team member, visualized with
            simple color-coded bars. Green means available, yellow means
            moderate, red means overloaded. Prevent burnout before it happens —
            and make smarter assignment decisions with data you can actually see.
          </p>
        }
        visual={<ResourceMock />}
        reversed
      />

      {/* ── 5. Proactive AI Insights ── */}
      <Section
        tag="Proactive AI Insights"
        heading="Your AI Project Manager Never Sleeps"
        body={
          <p>
            Get automatic, plain-English alerts when something needs your
            attention. Delayed tasks, overloaded team members, sprint risks —
            IntelliPM surfaces warnings before they become real problems. No
            more digging through dashboards to find what's going wrong.
          </p>
        }
        visual={<InsightsMock />}
        cta={{ label: 'Get Started', to: '/register' }}
      />

      {/* ── 6. Role-Based Access Control ── */}
      <Section
        tag="Role-Based Access Control"
        heading="The Right Access for the Right People"
        body={
          <p>
            Admins, Project Managers, and Team Members each see exactly what
            they need — and nothing they shouldn't. Whether it's managing users,
            assigning tasks, or updating status, every role has clear
            permissions. No clutter, no confusion.
          </p>
        }
        visual={<RolesMock />}
        reversed
      />
    </div>
  );
};

export default Features;
