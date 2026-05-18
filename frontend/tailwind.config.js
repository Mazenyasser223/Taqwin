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
        background: '#0a161c',
        surface: '#112129',
        border: '#1b323d',
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
