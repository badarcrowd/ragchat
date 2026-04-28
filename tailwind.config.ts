import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#161616",
        moss: "#2f6b4f",
        coral: "#db6b57",
        wheat: "#f5efe5",
        line: "#ded7cd"
      },
      boxShadow: {
        widget: "0 18px 55px rgba(22, 22, 22, 0.2)"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
