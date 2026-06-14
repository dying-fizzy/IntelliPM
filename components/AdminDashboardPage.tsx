import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import { 
  ArrowRight, Shield, ShieldCheck, Settings, Users, Focus, 
  Trash2, Edit, Activity, Folders, Database, Sliders, History
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


const UserManagementVisual = () => {
   const users = [
      { name: 'Sarah Chen', email: 'sarah.c@intellipm.com', role: 'Admin', color: '#ef4444' },
      { name: 'James Rivera', email: 'james.r@intellipm.com', role: 'PM', color: 'var(--accent)' },
      { name: 'Ali Malik', email: 'ali.m@intellipm.com', role: 'Member', color: '#3b82f6' },
      { name: 'Zara Tariq', email: 'zara.t@intellipm.com', role: 'Member', color: '#3b82f6' },
   ];

   return (
    <div
      className="w-full rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
       <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 text-[10px] mono uppercase font-bold tracking-widest opacity-50">
          <div className="w-[40%]">User</div>
          <div className="w-[20%] text-center">Role</div>
          <div className="w-[40%] text-right">Actions</div>
       </div>

       <div className="flex flex-col">
          {users.map((u, i) => (
             <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                <div className="w-[40%] flex flex-col">
                   <span className="text-[13px] font-bold">{u.name}</span>
                   <span className="text-[10px] opacity-40">{u.email}</span>
                </div>
                <div className="w-[20%] flex justify-center">
                   <span
                      className="mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                      style={{ background: `${u.color}15`, color: u.color }}
                   >
                     {u.role}
                   </span>
                </div>
                <div className="w-[40%] flex justify-end gap-2">
                   <button className="p-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors text-[var(--accent)]"><Edit size={14} /></button>
                   <button className="p-1.5 rounded bg-[#ef4444]/10 hover:bg-[#ef4444]/20 transition-colors text-[#ef4444]"><Trash2 size={14} /></button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}


const ProjectControlVisual = () => {
   const projects = [
      { name: 'Core API Redesign', status: 'Active', color: 'var(--accent)' },
      { name: 'Mobile App V2', status: 'At Risk', color: '#f59e0b' },
      { name: 'Legacy Migration', status: 'Archived', color: '#6b7280' },
   ];
   
   return (
      <div className="flex flex-col gap-3 w-full">
         <div className="flex items-center gap-2 mb-2 p-1">
            <Folders size={16} />
            <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Organization Projects</span>
         </div>
         {projects.map((p, i) => (
            <div
               key={i}
               className="rounded-lg p-5 flex items-center justify-between transition-all"
               style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
               }}
            >
               <span className="text-[14px] font-bold leading-none">{p.name}</span>
               <div className="flex items-center gap-4">
                  <span
                     className="mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm"
                     style={{ background: `${p.color}15`, color: p.color }}
                  >
                     {p.status}
                  </span>
               </div>
            </div>
         ))}
      </div>
   )
}


const AuditTrailVisual = () => {
   const logs = [
      { action: 'ROLE_UPDATE', user: 'Admin', time: '10 min ago', details: 'Ali Malik: Member → PM', color: 'var(--accent)' },
      { action: 'PROJECT_ARCHIVED', user: 'Sarah C.', time: '2 hrs ago', details: 'Legacy Migration', color: '#6b7280' },
      { action: 'USER_DELETED', user: 'Admin', time: '1 day ago', details: 'john.d@old.com', color: '#ef4444' },
      { action: 'TASK_CREATED', user: 'James R.', time: '1 day ago', details: 'Setup OAuth via Google', color: '#3b82f6' },
   ];

   return (
    <div
      className="w-full rounded-lg overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        padding: '24px',
      }}
    >
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <History size={16} style={{ color: 'var(--accent)' }}/>
          <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">System Audit Log</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {logs.map((l, i) => (
          <div key={i} className="flex flex-col gap-1">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }}></div>
                   <span className="text-[12px] font-bold">{l.action}</span>
                </div>
                <span className="mono text-[9px] uppercase opacity-40">{l.time}</span>
             </div>
             <div className="flex items-center justify-between px-3">
                <span className="text-[11px] opacity-60 font-mono">{l.details}</span>
                <span className="text-[10px] opacity-40 flex items-center gap-1"><Shield size={10}/> {l.user}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}


const AISettingsVisual = () => {
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
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
        <Settings size={16} />
        <span className="mono text-[12px] font-bold uppercase tracking-[0.1em]">Global AI Config</span>
      </div>

      <div className="flex flex-col gap-6">
        <div>
           <div className="flex justify-between items-end mb-3">
             <div className="flex flex-col">
                <span className="text-[13px] font-bold mb-1">Skill Weight Match</span>
             </div>
             <span className="mono text-[11px] font-bold" style={{ color: 'var(--accent)' }}>65%</span>
           </div>
           
           <div className="relative w-full h-1.5 bg-white/10 rounded-full">
             <div className="absolute left-0 top-0 h-full bg-[var(--accent)] rounded-full" style={{ width: '65%' }}></div>
             <div className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-[var(--bg-primary)]" style={{ left: '65%' }}></div>
           </div>
        </div>

        <div>
           <div className="flex justify-between items-end mb-3">
             <div className="flex flex-col">
                <span className="text-[13px] font-bold mb-1">Availability Match</span>
             </div>
             <span className="mono text-[11px] font-bold opacity-50">35%</span>
           </div>
           
           <div className="relative w-full h-1.5 bg-white/10 rounded-full">
             <div className="absolute left-0 top-0 h-full bg-white/40 rounded-full" style={{ width: '35%' }}></div>
             <div className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-[var(--bg-primary)]" style={{ left: '35%' }}></div>
           </div>
        </div>
      </div>
      
      <div className="mt-8 p-3 w-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-center rounded-sm">
         <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Changes Sync Locally</span>
      </div>
    </div>
  );
};


const SystemMetricsVisual = () => {
   const metrics = [
      { label: 'Total Users', value: '45', icon: <Users size={16} /> },
      { label: 'Active Projects', value: '12', icon: <Folders size={16} /> },
      { label: 'Total Tasks', value: '842', icon: <Database size={16} /> },
      { label: 'System Status', value: '99.9%', icon: <Activity size={16} />, color: '#22c55e' },
   ]
   return (
       <div className="grid grid-cols-2 gap-4 w-full">
         {metrics.map((m, i) => (
            <div
               key={i}
               className="rounded-lg p-5 flex flex-col justify-between h-28"
               style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
               }}
            >
               <div className="flex justify-between items-start opacity-50">
                  <span className="mono text-[9px] font-bold uppercase tracking-widest">{m.label}</span>
                  {m.icon}
               </div>
               <span 
                 className="text-3xl font-black" 
                 style={{ color: m.color ? m.color : 'inherit' }}
               >
                 {m.value}
               </span>
            </div>
         ))}
       </div>
   )
}


const AdminDashboardPage: React.FC = () => {
  const { ref, visible } = useInView(0.12);

  return (
    <main className="w-full relative overflow-hidden bg-[var(--bg-primary)]">
      <NeuralBackground />
      <div className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-40 pb-20 px-8 md:px-12 lg:px-20 w-full text-center max-w-5xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest mb-8">
            <ShieldCheck size={14} /> Admin Privileges
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.05] tracking-tight text-[var(--text-primary)]">
            Total Control. <br className="hidden md:block" /> Complete Visibility.
          </h1>
          <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            The IntelliPM Admin Dashboard gives system administrators full command 
            over users, projects, permissions, and system health — all from one place.
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
        <div className="w-full flex flex-col gap-0 pb-24 border-t border-white/5">
          <Section
            tag="Access Management"
            heading="Manage Every User in the System"
            body={
              <p>
                Admins can view all registered users, change their roles (promote to Admin 
                or Project Manager, demote to Team Member), reset access, or permanently 
                remove accounts. A confirmation flow prevents accidental deletions.
              </p>
            }
            visual={<UserManagementVisual />}
          />

          <Section
            tag="Global Overseer"
            heading="Oversee Every Project Across the Organization"
            body={
              <p>
                Admins see all projects system-wide — not just their own. They can archive 
                inactive projects, force-close stalled ones, or permanently delete them 
                when absolutely necessary to keep the workspace clean.
              </p>
            }
            visual={<ProjectControlVisual />}
            reversed
          />
          
          <Section
            tag="Security Logging"
            heading="Nothing is Ever Untraceable"
            body={
              <p>
                Every single action in IntelliPM — task created, user deleted, role changed, 
                project archived — is logged permanently in the robust Audit Trail. Each log 
                entry shows who did what, when, and what the data looked like before and after.
              </p>
            }
            visual={<AuditTrailVisual />}
          />
          
          <Section
            tag="Algorithm Configuration"
            heading="Tune the Intelligence to Your Organization"
            body={
              <p>
                Admins can dynamically adjust the weighting of the Smart Assign AI algorithm — 
                deciding how much importance to give Skill Match versus Availability based on 
                the organization's current operational tempo. Settings take effect immediately 
                system-wide.
              </p>
            }
            visual={<AISettingsVisual />}
            reversed
          />
          
          <Section
            tag="Observability"
            heading="Live System Health at a Glance"
            body={
              <p>
                The dashboard surfaces real-time counts of active users, running projects, 
                total tasks dispersed across the database, and overall system status — 
                giving administrators immediate situational awareness.
              </p>
            }
            visual={<SystemMetricsVisual />}
          />
        </div>

        {/* BOTTOM CTA */}
        <section className="py-32 px-8 text-center w-full max-w-4xl mx-auto border-t border-white/5 bg-white/[0.01]">
          <h2 className="text-3xl md:text-5xl font-black mb-6 text-[var(--text-primary)] tracking-tight">Built for the People Who<br className="hidden md:block"/> Keep Everything Running.</h2>
          <p className="opacity-50 text-lg mb-10 max-w-xl mx-auto">
            Give your operations team the control panel they need.
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

export default AdminDashboardPage;
