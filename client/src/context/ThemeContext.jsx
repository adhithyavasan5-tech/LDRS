import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ldrs_theme') || 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState('dark');

  useEffect(() => {
    const applyTheme = (t) => {
      const root = document.documentElement;
      if (t === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', systemDark);
        setResolvedTheme(systemDark ? 'dark' : 'light');
      } else {
        root.classList.toggle('dark', t === 'dark');
        setResolvedTheme(t);
      }
    };

    applyTheme(theme);
    localStorage.setItem('ldrs_theme', theme);

    // Listen for system theme changes
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => {
      if (t === 'dark') return 'light';
      if (t === 'light') return 'system';
      return 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
