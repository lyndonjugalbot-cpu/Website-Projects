import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Seoul Stop Kmart brand palette, sampled from the official logo
        // (public/brand/logo.png) — see components/Header.tsx for usage.
        brand: {
          red: "#D41A1A",
          "red-dark": "#821010",
          gold: "#FFC600",
          "gold-dark": "#9C7900",
          black: "#171412",
          cream: "#FAF6EF",
          sand: "#EFE7DA",
          ink: "#2A2420",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "rise": "fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
