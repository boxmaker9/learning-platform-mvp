import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FBF7ED",
          100: "#F5EBD3",
          200: "#EBDFC4",
          300: "#DFD0B0",
          400: "#CDBE98",
          500: "#B8A67E",
          600: "#9A8664",
          700: "#7D6D4F",
          800: "#5E523C",
          900: "#3F3728",
        },
        primary: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
      },
    },
  },
  plugins: [],
}

export default config
