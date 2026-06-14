
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { ChevronRight } from 'lucide-react';

const Hero: React.FC = () => {
  const { theme } = useTheme();

  return (
    <section className="pt-32 pb-16 px-8 md:px-12 w-full">
      <div className="w-full">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-6 leading-[1.05] tracking-tight">
          The Developer’s <br /> Intelligent <br /> Project Manager.
        </h1>
        <p className="opacity-60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
          Automating task allocation and predicting project risks so your team can focus on building. High-density, data-first intelligence utilized at scale.
        </p>

      </div>
    </section>
  );
};

export default Hero;
