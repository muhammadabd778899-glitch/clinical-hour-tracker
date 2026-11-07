/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#F6F3EC',
          surface: '#FFFFFF',
          ink: '#0B1B18',
          'ink-soft': '#112A25',
          primary: '#0D5B51',
          'primary-dark': '#073F38',
          'primary-light': '#E4F2ED',
          secondary: '#2C6B8A',
          'secondary-light': '#EAF2F7',
          gold: '#B98A33',
          'gold-dark': '#956C20',
          'gold-light': '#F8EFDC',
          text: '#14201C',
          muted: '#6A7872',
          border: '#E6DFD1',
          danger: '#B23F38',
          'danger-light': '#FBEDEB',
          warning: '#9A6A1D',
          'warning-light': '#FBF2E1',
          success: '#2B7256',
          'success-light': '#E7F3ED',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 32, 28, 0.04), 0 12px 32px -22px rgba(11, 27, 24, 0.28)',
        lift: '0 2px 6px rgba(20, 32, 28, 0.05), 0 22px 48px -28px rgba(11, 27, 24, 0.35)',
        pop: '0 18px 50px -18px rgba(11, 27, 24, 0.35)',
        hero: '0 40px 90px -50px rgba(6, 46, 42, 0.85)',
      },
      borderRadius: {
        card: '16px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'Times New Roman', 'serif'],
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
