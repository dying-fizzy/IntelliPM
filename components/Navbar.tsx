
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { Sun, Moon, LogOut, Terminal, Layout } from 'lucide-react';

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    setIsLoggedIn(!!localStorage.getItem('user'));
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all border-b w-full ${
      scrolled 
        ? 'glass-nav py-2.5 border-[var(--border-color)]' 
        : 'py-4 bg-transparent border-transparent'
    }`}>
      <div className="w-full px-8 md:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-7 h-7 bg-[var(--accent)] text-black dark:text-black flex items-center justify-center font-black text-xs rounded-sm">
            I
          </div>
          <span className="text-sm font-black tracking-widest uppercase mono">IntelliPM</span>
        </Link>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-1.5 opacity-50 hover:opacity-100">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="text-[14px] font-bold uppercase text-[var(--accent)] flex items-center gap-1.5">
                  <Layout size={12} /> Dashboard
                </Link>
                <button onClick={() => { localStorage.removeItem('user'); navigate('/'); }} className="text-[14px] font-bold uppercase opacity-50">
                  Exit
                </button>
              </div>
            ) : (
              <Link to="/auth" className="text-[14px] font-bold uppercase bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-1.5 rounded-sm hover:opacity-90">
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
