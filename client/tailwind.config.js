/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary — Deep Mauve/Plum
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Accent — Warm Crimson/Rose
        accent: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        // Gold — Soft amber for ratings/highlights
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Dark backgrounds
        dark: {
          50: '#18181b',
          100: '#141414',
          200: '#0f0f12',
          300: '#0a0a0d',
          400: '#050507',
        },
        // Surface (glass cards)
        surface: {
          dark: 'rgba(255,255,255,0.05)',
          light: 'rgba(255,255,255,0.8)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        glow: '0 0 20px rgba(168, 85, 247, 0.3)',
        'glow-accent': '0 0 20px rgba(244, 63, 94, 0.3)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        'card-dark': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-light': '0 4px 24px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-dark':
          'radial-gradient(ellipse at 60% 40%, rgba(126, 34, 206, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(190, 18, 60, 0.15) 0%, transparent 50%)',
        'hero-light':
          'radial-gradient(ellipse at 60% 40%, rgba(168, 85, 247, 0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(244, 63, 94, 0.06) 0%, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        float: 'float 6s ease-in-out infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
