import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b9dcff",
          300: "#8cc5ff",
          400: "#5eacff",
          500: "#2f92ff",
          600: "#0f78ea",
          700: "#0b60bf",
          800: "#084994",
          900: "#053368"
        }
      }
    },
  },
  plugins: [],
} satisfies Config;
