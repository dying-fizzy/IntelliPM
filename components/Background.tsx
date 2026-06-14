
import React from 'react';
import { useTheme } from './ThemeContext';

const Background: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 -z-0 pointer-events-none overflow-hidden">
      {/* Primary Gradient Mesh */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-40 animate-pulse transition-colors duration-1000 ${
        theme === 'dark' ? 'bg-green-600/20' : 'bg-blue-400/20'
      }`}></div>
      
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-40 animate-pulse transition-colors duration-1000 delay-700 ${
        theme === 'dark' ? 'bg-purple-600/20' : 'bg-pink-400/20'
      }`}></div>

      {/* Grid Pattern */}
      <div className={`absolute inset-0 opacity-[0.03] ${
        theme === 'dark' ? 'bg-[url("https://www.transparenttextures.com/patterns/carbon-fibre.png")]' : 'bg-[url("https://www.transparenttextures.com/patterns/bright-squares.png")]'
      }`}></div>
      
      {/* Subtle lines */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${
        theme === 'dark' ? 'opacity-20' : 'opacity-5'
      }`} style={{ backgroundImage: `linear-gradient(${theme === 'dark' ? '#333' : '#ddd'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'dark' ? '#333' : '#ddd'} 1px, transparent 1px)`, backgroundSize: '40px 40px' }}></div>
    </div>
  );
};

export default Background;
