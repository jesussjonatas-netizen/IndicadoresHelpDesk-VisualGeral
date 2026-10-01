import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto Condensed", "sans-serif"],
        heading: ["Arial Narrow", "sans-serif"],
      },
    },
  },
} satisfies Config;