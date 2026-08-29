import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        annotation: {
          indigo: {
            border: "rgba(99, 102, 241, 0.35)",
            bg: "rgba(99, 102, 241, 0.08)",
            hover: "rgba(99, 102, 241, 0.18)",
          },
          amber: {
            border: "rgba(245, 158, 11, 0.35)",
            bg: "rgba(245, 158, 11, 0.08)",
            hover: "rgba(245, 158, 11, 0.18)",
          },
          emerald: {
            border: "rgba(16, 185, 129, 0.35)",
            bg: "rgba(16, 185, 129, 0.08)",
            hover: "rgba(16, 185, 129, 0.18)",
          },
          rose: {
            border: "rgba(244, 63, 94, 0.35)",
            bg: "rgba(244, 63, 94, 0.08)",
            hover: "rgba(244, 63, 94, 0.18)",
          },
          sky: {
            border: "rgba(14, 165, 233, 0.35)",
            bg: "rgba(14, 165, 233, 0.08)",
            hover: "rgba(14, 165, 233, 0.18)",
          },
          fuchsia: {
            border: "rgba(217, 70, 239, 0.35)",
            bg: "rgba(217, 70, 239, 0.08)",
            hover: "rgba(217, 70, 239, 0.18)",
          },
          lime: {
            border: "rgba(132, 204, 22, 0.35)",
            bg: "rgba(132, 204, 22, 0.08)",
            hover: "rgba(132, 204, 22, 0.18)",
          },
          orange: {
            border: "rgba(249, 115, 22, 0.35)",
            bg: "rgba(249, 115, 22, 0.08)",
            hover: "rgba(249, 115, 22, 0.18)",
          },
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
