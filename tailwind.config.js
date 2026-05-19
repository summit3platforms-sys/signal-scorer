/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0e17',
        card: '#0f1923',
        cardBorder: '#1e2d40',
        accentLong: '#00d4aa',
        accentShort: '#ff4d6d',
        scoreHigh: '#3b82f6',
        scoreVeryHigh: '#10b981',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
