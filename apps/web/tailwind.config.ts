import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05060a",
          900: "#0b0d14",
          800: "#12151f",
          700: "#1a1f2e",
        },
        accent: {
          DEFAULT: "#6ee7ff",
          dim: "#22d3ee",
          soft: "rgba(110, 231, 255, 0.12)",
        },
        mint: {
          DEFAULT: "#86efac",
          soft: "rgba(134, 239, 172, 0.12)",
        },
        warn: {
          DEFAULT: "#fbbf24",
          soft: "rgba(251, 191, 36, 0.12)",
        },
        danger: {
          DEFAULT: "#fb7185",
          soft: "rgba(251, 113, 133, 0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(110, 231, 255, 0.12)",
        card: "0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.35)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
