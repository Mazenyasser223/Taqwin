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
          DEFAULT: '#158b8d',
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
          400: '#158b8d',
          500: '#158b8d',
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
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
