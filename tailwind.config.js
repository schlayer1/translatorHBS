/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        school: {
          blue: '#0B7BA7',
          blueDark: '#085a7a',
          blueLight: '#e1f3fa',
          teal: '#00A896',
          tealDark: '#007a6d',
          tealLight: '#e0f7f4',
          orange: '#E67E22',
          orangeDark: '#c26210',
          orangeLight: '#fdf2e9',
          yellow: '#F59E0B',
          bg: '#FFFBF5',
          surface: '#FFFFFF',
          card: '#F8FAFC',
          border: '#F1E9DA',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 12px -2px rgba(11, 123, 167, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'float': '0 10px 25px -5px rgba(11, 123, 167, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
