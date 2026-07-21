/** @type {import('tailwindcss').Config} */

// One palette, one meaning per colour. The previous build used 14 accent shades with emerald
// simultaneously meaning "info", "healthy", "measured", "intact", "correct" and every primary
// button — which is the same as meaning nothing.
//
//   ink      surfaces, in four steps of depth
//   accent   interactive affordances only. Never used to signal state.
//   severity one ordered ramp, used for nothing but severity
//   good/bad verification and verdict outcomes only
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090b',   // page
          900: '#0e1013',   // panel
          800: '#151920',   // raised panel / hover
          700: '#1e232c',   // borders
          600: '#2b323d',   // strong borders
        },
        content: {
          DEFAULT: '#e7e9ec',
          muted: '#98a1ae',
          faint: '#6b7482',
        },
        accent: {
          DEFAULT: '#5b8def',
          soft: 'rgba(91, 141, 239, 0.12)',
          line: 'rgba(91, 141, 239, 0.32)',
        },
        severity: {
          critical: '#e5484d',
          high: '#ef8034',
          medium: '#d4a72c',
          low: '#5b8def',
          info: '#6b7482',
        },
        good: '#30a46c',
        bad: '#e5484d',
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
      },
      borderRadius: { panel: '0.625rem' },
    },
  },
  plugins: [],
}
