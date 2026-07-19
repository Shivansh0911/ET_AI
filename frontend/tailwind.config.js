/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        card: '#12121a',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.2)',
      }
    },
  },
  plugins: [],
}
