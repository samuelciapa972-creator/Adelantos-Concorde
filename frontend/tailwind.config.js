/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Serifa de texto (con eje de tamaño óptico) para títulos y cifras grandes,
        // como en un libro contable impreso; sans de trabajo de la misma familia para la interfaz.
        display: ['"Source Serif 4 Variable"', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Source Sans 3 Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Neutros con un leve matiz hacia el índigo de la marca
        ink:     { DEFAULT: '#15141F', soft: '#4B4A5A', mute: '#7B7A8A' },
        surface: { DEFAULT: '#F6F6F9', raised: '#FFFFFF', sunken: '#EFEFF4' },
        line:    { DEFAULT: '#E4E3EB', strong: '#CFCDDA' },
        night:   { DEFAULT: '#0E0D14', raised: '#1A1924', line: '#2A2936' },
        brand: {
          50:  '#EEEDFE',
          100: '#CECBF6',
          500: '#534AB7',
          600: '#463E9F',
          700: '#3C3489',
          900: '#26215C',
        },
        // Estado (reservados: nunca se usan como color de serie)
        ok:   { DEFAULT: '#0F7B4F', soft: '#E3F5EC' },
        warn: { DEFAULT: '#9A5B00', soft: '#FDF1D8' },
        bad:  { DEFAULT: '#B42318', soft: '#FDE8E6' },
      },
      boxShadow: {
        card: '0 1px 2px rgb(21 20 31 / 0.04), 0 1px 1px rgb(21 20 31 / 0.03)',
        pop:  '0 12px 32px -8px rgb(21 20 31 / 0.25), 0 2px 6px rgb(21 20 31 / 0.08)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer:   { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .18s ease-out',
        'fade-in': 'fade-in .15s ease-out',
      },
    },
  },
  plugins: [],
}
