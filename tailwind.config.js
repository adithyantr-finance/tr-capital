/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: '#12121A',
        elevated: '#1A1A26',
        border: '#2A2A3A',
        primary: {
          DEFAULT: '#C8A96E', // gold
          hover: '#B5965B',
        },
        secondary: {
          DEFAULT: '#4A9EFF', // electric blue
          hover: '#3586E6',
        },
        success: '#22C55E', // green
        danger: '#EF4444', // red
        muted: '#A0A0B0',
        cream: '#E8DCC8',
        hint: '#505065',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
