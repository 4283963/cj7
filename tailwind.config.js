/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        lab: {
          bg: '#0F172A',
          bgCard: '#1E293B',
          bgLight: '#334155',
          border: '#475569',
          text: '#F1F5F9',
          textMuted: '#94A3B8',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          running: '#3B82F6',
          pending: '#8B5CF6',
          cpu: '#2563EB',
          memory: '#9333EA',
        }
      },
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(71, 85, 105, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(71, 85, 105, 0.3) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '20px 20px',
      }
    },
  },
  plugins: [],
};
