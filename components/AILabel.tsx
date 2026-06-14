
import React from 'react';
import { Sparkles } from 'lucide-react';

/* ─────────────────────────────────────────────────────
   AIBadge — inline label for AI-powered features
   Usage: <AIBadge />  or  <AIBadge label="Smart Assign" />
───────────────────────────────────────────────────── */
export const AIBadge: React.FC<{ label?: string }> = ({ label = 'AI' }) => (
  <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 leading-none select-none">
    <Sparkles size={8} />
    {label}
  </span>
);

/* ─────────────────────────────────────────────────────
   AITooltipButton — wraps any button with an AI label
   and a one-sentence tooltip on hover.

   Props:
     label       — visible button text (e.g. "Smart Assign")
     tooltip     — one sentence explanation shown on hover
     badgeLabel  — text inside the AI badge (default "AI")
     onClick     — handler
     disabled    — pass-through
     className   — extra classes for the button
     children    — optional inner content override
───────────────────────────────────────────────────── */
interface AITooltipButtonProps {
  label: string;
  tooltip: string;
  badgeLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const AITooltipButton: React.FC<AITooltipButtonProps> = ({
  label,
  tooltip,
  badgeLabel = 'AI',
  onClick,
  disabled,
  className = '',
  children,
}) => (
  <div className="relative group inline-flex w-full">
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children ?? (
        <>
          <Sparkles size={14} />
          {label}
        </>
      )}
    </button>

    {/* Tooltip */}
    <div
      className="
        pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5
        w-64 z-50
        opacity-0 group-hover:opacity-100
        translate-y-1 group-hover:translate-y-0
        transition-all duration-200 ease-out
      "
    >
      <div className="bg-[var(--bg-primary)] border border-[var(--accent)]/30 rounded-sm p-3 shadow-2xl text-left">
        {/* Header row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={10} className="text-[var(--accent)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)]">
            {badgeLabel}
          </span>
        </div>
        {/* Explanation */}
        <p className="text-[11px] leading-relaxed opacity-70 mono">
          {tooltip}
        </p>
      </div>
      {/* Caret */}
      <div className="mx-auto w-2 h-2 bg-[var(--bg-primary)] border-r border-b border-[var(--accent)]/30 rotate-45 -mt-1" />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────
   AISectionHeader — section label for AI panels
   Replaces plain "Smart Assignment" headers.
───────────────────────────────────────────────────── */
export const AISectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="px-5 py-3.5 bg-white/3 border-b border-[var(--border-color)] flex items-center gap-2.5">
    <div className="w-5 h-5 rounded-sm bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
      <Sparkles size={11} className="text-[var(--accent)]" />
    </div>
    <div className="min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">{title}</span>
      {subtitle && (
        <span className="text-[9px] mono opacity-30 ml-2">{subtitle}</span>
      )}
    </div>
    <span className="ml-auto text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
      AI
    </span>
  </div>
);
