/** @type {import('tailwindcss').Config} */

// CyberSentinel design system.
//
// Surfaces are layered navy-slate with a deliberate gap between each step, so a card visibly
// sits above the page and a raised element visibly sits above the card. The earlier palette
// kept all four levels within a few points of each other, which is why the whole interface
// read as one flat black sheet. Depth in dark mode comes from surface lightness — shadows
// barely register — so the steps have to be large enough to see.
//
// Colour still carries meaning: `accent` for interaction and focus, `severity` for severity
// only, `good`/`bad` for verification outcomes. `viz` is the one addition — a categorical
// ramp for chart series that are not statuses (flows, sectors), so charts can be legible
// without borrowing severity colours and implying a threat level that is not there.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0f18',   // page
          1: '#121926',   // cards
          2: '#1b2433',   // raised: rows, chips, hover
          3: '#253044',   // inputs, active selections
        },
        line: {
          DEFAULT: '#2a3648',
          soft: '#212c3c',
          strong: '#3b4a61',
        },
        ink: {
          DEFAULT: '#eef1f6',
          muted: '#a3aebf',
          faint: '#717d90',
        },
        accent: {
          DEFAULT: '#6d8cf5',
          hover: '#8aa2f8',
          soft: 'rgba(109, 140, 245, 0.14)',
          line: 'rgba(109, 140, 245, 0.38)',
        },
        severity: {
          critical: '#f0616a',
          high: '#f08a3c',
          medium: '#e0b53c',
          low: '#5b9ad6',
          info: '#717d90',
        },
        // Categorical series colours. Never used to signal status.
        viz: {
          1: '#6d8cf5',
          2: '#46b8a8',
          3: '#9b7bf0',
          4: '#5aa9e6',
          5: '#7e8aa3',
        },
        good: '#3fb47f',
        bad: '#f0616a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.07em' }],
        meta: ['0.75rem', { lineHeight: '1.15rem' }],
        body: ['0.8125rem', { lineHeight: '1.5rem' }],
        title: ['0.9375rem', { lineHeight: '1.4rem', letterSpacing: '-0.01em' }],
        heading: ['1.375rem', { lineHeight: '1.8rem', letterSpacing: '-0.02em' }],
        tabular: ['1.375rem', { lineHeight: '1.7rem', letterSpacing: '-0.02em' }],
        figure: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],
        display: ['2.25rem', { lineHeight: '2.4rem', letterSpacing: '-0.035em' }],
      },
      borderRadius: { card: '0.75rem' },
      spacing: { 4.5: '1.125rem' },
      boxShadow: {
        // Just enough to separate a floating element from the page behind it.
        float: '0 18px 40px -12px rgba(0, 0, 0, 0.7)',
      },
    },
  },
  plugins: [],
}
