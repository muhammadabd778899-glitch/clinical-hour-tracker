/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#F7F8FA',
          surface: '#FFFFFF',
          primary: '#147D78',
          'primary-dark': '#0F5F5B',
          'primary-light': '#E6F4F3',
          secondary: '#4779A8',
          'secondary-light': '#EDF3F9',
          text: '#202B3C',
          muted: '#718096',
          border: '#E6EAF0',
          danger: '#C2413B',
          'danger-light': '#FBEDEC',
          warning: '#B7791F',
          'warning-light': '#FCF6E8',
          success: '#2F855A',
          'success-light': '#EAF6EF',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(32, 43, 60, 0.04), 0 1px 3px rgba(32, 43, 60, 0.06)',
        pop: '0 8px 24px rgba(32, 43, 60, 0.12)',
      },
      borderRadius: {
        card: '12px',
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
      },
    },
  },
  plugins: [],
};
