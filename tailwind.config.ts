import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          light: "#F8FAFC",
          dark: "#0F172A"
        },
        panel: {
          light: "#FFFFFF",
          dark: "#1E293B"
        },
        border: {
          light: "#CBD5F5",
          dark: "#334155"
        },
        text: {
          light: "#0F172A",
          dark: "#E2E8F0"
        },
        muted: {
          light: "#64748B",
          dark: "#94A3B8"
        }
      }
    }
  },
  plugins: []
};

export default config;
