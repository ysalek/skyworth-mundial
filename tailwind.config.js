/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        sport: ['Bebas Neue', 'sans-serif'],
      },
      colors: {
        skyworth: {
          blue: '#0B6FBF',    /* Azul Intenso Texto */
          dark: '#071A2E',    /* Azul Noche Estadio (Background) */
          navy: '#0B2A4A',
          orange: '#FF6A00',  /* Naranja CTA */
          'orange-glow': '#FFB000',
          accent: '#FF6A00',
        }
      },
      backgroundImage: {
        'stadium-gradient': 'radial-gradient(circle at center, #005BBB 0%, #001A3D 100%)',
        'pattern-soccer': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      }
    }
  },
  plugins: [],
}
