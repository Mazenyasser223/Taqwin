/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './3d/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
    './components/tailadmin/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a8a8a',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#f37021',
          foreground: '#ffffff',
        },
        background: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        brand: {
          50: '#ecf3ff',
          400: '#1a8a8a',
          500: '#1a8a8a',
          600: '#127072',
        },
        success: {
          50: '#ecfdf3',
          500: '#12b76a',
          600: '#039855',
        },
        error: {
          50: '#fef3f2',
          500: '#f04438',
          600: '#d92d20',
        },
        warning: {
          50: '#fffaeb',
          500: '#f79009',
        },
        gray: {
          25: '#fcfcfd',
          100: '#f2f4f7',
          200: '#e4e7ec',
          400: '#98a2b3',
          500: '#667085',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
        },
      },
      fontSize: {
        'title-sm': ['1.875rem', { lineHeight: '2.25rem' }],
        'theme-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'theme-xs': ['0.75rem', { lineHeight: '1.125rem' }],
      },
      boxShadow: {
        default: '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        display: ['Outfit', 'Changa', 'sans-serif'],
        slogan: ['Changa', 'Outfit', 'sans-serif'],
        changa: ['Changa', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slogan-float': 'slogan-float 4s ease-in-out infinite',
        'slogan-shimmer': 'slogan-shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        'slogan-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-6px) rotate(2deg)' },
        },
        'slogan-shimmer': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};
