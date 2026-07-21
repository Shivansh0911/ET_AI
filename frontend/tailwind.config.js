/** @type {import('tailwindcss').Config} */

// CyberSentinel design system.
//
// Surfaces are layered slate, never pure black — analysts work long shifts in low light, and
// #000 gives you no way to show elevation. Depth comes from surface lightness, not shadow.
//
// Colour carries meaning or it does not appear. One accent (indigo) for interaction and focus
// only; the severity ramp for severity only; good/bad for verification outcomes only. Nothing
// is coloured because it looked nice.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Elevation, darkest to lightest. Higher number reads as closer to the viewer.
        surface: {
          0: '#0c1017',   // app background
          1: '#121722',   // cards
          2: '#19202c',   // raised elements inside cards, hover
          3: '#212a38',   // inputs, chips
        },
        line: {
          DEFAULT: '#232c3b',  // standard divider
          strong: '#2f3a4c',   // emphasised edge
        },
        ink: {
          DEFAULT: '#e8ecf2',  // primary text — off-white, not #fff
          muted: '#9aa5b6',    // secondary
          faint: '#697384',    // tertiary, labels
        },
        accent: {
          DEFAULT: '#6d8cf5',
          hover: '#8199f7',
          soft: 'rgba(109, 140, 245, 0.12)',
          line: 'rgba(109, 140, 245, 0.35)',
        },
        severity: {
          critical: '#f0616a',
          high: '#f08a3c',
          medium: '#e0b53c',
          low: '#5b9ad6',
          info: '#697384',
        },
        good: '#3fb47f',
        bad: '#f0616a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // A deliberate scale. Labels are small and letter-spaced; figures are large and tight.
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.07em' }],
        meta: ['0.75rem', { lineHeight: '1.15rem' }],
        body: ['0.8125rem', { lineHeight: '1.5rem' }],
        title: ['0.9375rem', { lineHeight: '1.4rem', letterSpacing: '-0.01em' }],
        figure: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],
        display: ['2.25rem', { lineHeight: '2.4rem', letterSpacing: '-0.035em' }],
      },
      borderRadius: { card: '0.75rem' },
      spacing: { 4.5: '1.125rem' },
    },
  },
  plugins: [],
}
