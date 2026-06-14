
import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const linkStyle =
    'text-[13px] transition-colors hover:text-[var(--accent)]';

  return (
    <footer
      style={{
        background: '#0f0f0f',
        borderTop: '1px solid var(--accent)',
      }}
    >
      {/* ── Main grid ── */}
      <div className="w-full px-8 md:px-12 lg:px-20 pt-16 pb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-14 lg:gap-12">
          {/* Column 1 — Brand */}
          <div className="flex flex-col gap-5 max-w-xs">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div
                className="w-7 h-7 flex items-center justify-center font-black text-xs rounded-sm"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                I
              </div>
              <span className="text-sm font-black tracking-widest uppercase mono">
                IntelliPM
              </span>
            </Link>

            <p className="text-[13px] leading-relaxed" style={{ opacity: 0.5 }}>
              AI-native project management for modern engineering teams.
              Built to think ahead.
            </p>

            <Link
              to="/register"
              className="inline-flex items-center justify-center text-[12px] font-black uppercase tracking-[0.15em] px-6 py-2.5 rounded-sm transition-all hover:brightness-110"
              style={{
                background: 'var(--accent)',
                color: '#000',
                width: 'fit-content',
              }}
            >
              Get Started
            </Link>
          </div>

          {/* Column 2 — Product */}
          <div>
            <h4
              className="mono text-[11px] font-bold uppercase tracking-[0.2em] mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              Product
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { name: 'Task Management', path: '/task-management' },
                { name: 'Smart Assign', path: '/smart-assign' },
                { name: 'AI Task Generation', path: '/ai-task-generation' },
                { name: 'Resource Intelligence', path: '/resource-intelligence' },
                { name: 'Risk Assessment', path: '/risk-assessment' },
                { name: 'Admin Dashboard', path: '/admin-dashboard' },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={linkStyle}
                    style={{ opacity: 0.45 }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = '1')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = '0.45')
                    }
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Company */}
          <div>
            <h4
              className="mono text-[11px] font-bold uppercase tracking-[0.2em] mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              Company
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { name: 'About', path: '/about' },
                { name: 'Careers', path: '/careers' },
                { name: 'Blog', path: '/blog' },
                { name: 'Contact', path: '/contact' },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={linkStyle}
                    style={{ opacity: 0.45 }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = '1')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = '0.45')
                    }
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <h4
              className="mono text-[11px] font-bold uppercase tracking-[0.2em] mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              Legal
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { name: 'Privacy Policy', path: '/privacy-policy' },
                { name: 'Terms of Service', path: '/terms-of-service' },
                { name: 'Cookie Policy', path: '/cookie-policy' },
                { name: 'Security', path: '/security' },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={linkStyle}
                    style={{ opacity: 0.45 }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = '1')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = '0.45')
                    }
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="w-full px-8 md:px-12 lg:px-20 py-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="text-[12px]" style={{ opacity: 0.35 }}>
          © {new Date().getFullYear()} IntelliPM. All rights reserved.
        </span>

        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: '#22c55e',
              boxShadow: '0 0 6px #22c55e80',
              animation: 'footerPulse 2s ease-in-out infinite',
            }}
          />
          <span className="text-[12px]" style={{ color: '#22c55e' }}>
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Pulse keyframe */}
      <style>{`
        @keyframes footerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
