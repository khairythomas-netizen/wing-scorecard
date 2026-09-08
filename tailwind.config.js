/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every token resolves to a CSS variable so light/dark swap in one place.
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        line: 'var(--line)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        orange: 'var(--orange)',
        gold: 'var(--gold)',
        green: 'var(--green)',
        blue: 'var(--blue)',
        danger: 'var(--danger)',
        violet: 'var(--violet)',
      },
      boxShadow: {
        card: 'var(--shadow)',
        glow: '0 8px 24px -6px rgb(255 100 47 / 0.45)',
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
