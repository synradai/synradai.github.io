/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        site: {
          bg: '#08090f',
          surface: '#0f1320',
          card: '#141929',
          border: '#1e2a3d',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
