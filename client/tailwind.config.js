/** @type {import('tailwindcss').Config} */
import {
  white,
  gray,
  indigo,
  rose,
  amber,
  sky,
  emerald,
} from "tailwindcss/colors";

export const content = [
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./components/**/*.{js,ts,jsx,tsx,mdx}",
  "./node_modules/rizzui/dist/*.{js,ts,jsx,tsx}",
];
export const theme = {
  extend: {
    colors: {
      /*
       * body, modal, drawer background & ring-offset-color
       */
      background: white,

      /*
       * body text color
       */
      foreground: gray[600],

      /*
       * border, default flat bg color for input components, tab & dropdown hover color
       */
      muted: gray[200],

      /*
       * primary colors
       */
      primary: {
        lighter: gray[200],
        DEFAULT: "#2778E3",
        dark: gray[950],
        foreground: white,
      },

      /*
       * secondary colors
       */
      secondary: {
        lighter: indigo[200],
        DEFAULT: indigo[500],
        dark: indigo[700],
        foreground: white,
      },

      /*
       * danger colors
       */
      red: {
        lighter: rose[200],
        DEFAULT: rose[500],
        dark: rose[700],
      },

      /*
       * warning colors
       */
      orange: {
        lighter: amber[200],
        DEFAULT: amber[500],
        dark: amber[700],
      },

      /*
       * info colors
       */
      blue: {
        lighter: sky[200],
        DEFAULT: sky[500],
        dark: sky[700],
      },

      /*
       * success colors
       */
      green: {
        lighter: emerald[200],
        DEFAULT: emerald[500],
        dark: emerald[700],
      },
    },
  },
};
export const plugins = [];
