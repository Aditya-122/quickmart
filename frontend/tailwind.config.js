/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
      },
    },
  },
  plugins: [],
}
