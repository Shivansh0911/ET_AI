/** @type {import('tailwindcss').Config} */

// CyberSentinel design system — light.
//
// Surfaces are near-white with a faintly cool page tint, so a white card visibly sits on top
// of it. On light backgrounds shadows actually render, so elevation comes from a soft shadow
// plus a hairline border rather than the surface-lightness trick a dark theme needs.
//
// Colour appears only where it carries meaning: `accent` for interaction and focus, `severity`
// for severity, `good`/`bad` for outcomes, `viz` for categorical chart series. Everything else
// is greyscale. Nothing is coloured for decoration.
//
// Every foreground here was checked against every surface with a WCAG contrast script:
// all pass AA for body text (>= 4.5:1) on card, page and raised. See the comment on `ink`.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#f6f7f9',   // page — a cool off-white so white cards separate from it
          1: '#ffffff',   // cards
          2: '#f2f4f7',   // raised: rows, chips, hover
          3: '#eaeef3',   // inputs, active selections
        },
        line: {
          DEFAULT: '#e3e7ed',   // hairline divider
          soft: '#edf0f4',
          strong: '#cfd6e0',    // emphasised edge
        },
        // ink 18.3:1, muted 6.4:1, faint 5.0:1 on white — all AA for body text.
        ink: {
          DEFAULT: '#10151c',
          muted: '#54606f',
          faint: '#67707e',
        },
        accent: {
          DEFAULT: '#2f56d9',
          hover: '#2545b8',
          soft: 'rgba(47, 86, 217, 0.08)',
          line: 'rgba(47, 86, 217, 0.28)',
        },
        // Darkened and desaturated for white. The dark theme's brighter ramp turns garish
        // and illegible on light surfaces.
        severity: {
          critical: '#c62828',
          high: '#b45309',
          medium: '#946200',
          low: '#1d4ed8',
          info: '#67707e',
        },
        viz: {
          1: '#2f56d9',
          2: '#0f766e',
          3: '#6d28d9',
          4: '#0369a1',
          5: '#526074',
        },
        good: '#15803d',
        bad: '#c62828',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
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
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        raised: '0 2px 4px rgba(16, 24, 40, 0.05), 0 4px 12px -2px rgba(16, 24, 40, 0.08)',
        float: '0 12px 32px -8px rgba(16, 24, 40, 0.18), 0 4px 8px -4px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
}
