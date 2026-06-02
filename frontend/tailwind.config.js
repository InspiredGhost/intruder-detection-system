/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'tut-blue': '#005596',
        'tut-gold': '#fdb813',
        'tut-red':  '#d7292f',
        'tut-teal': '#355458',
      },
    },
  },
  plugins: [],
}
