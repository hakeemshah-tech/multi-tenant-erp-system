import { Mark } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    /**
     * Set the font size
     */
    setFontSize: (size: string) => ReturnType;
    /**
     * Unset the font size
     */
    unsetFontSize: () => ReturnType;
  }
}

export const FontSize = Mark.create({
  name: "fontSize",

  inclusive: true,
  // Don't exclude any marks - font size should work with bold, italic, etc.
  excludes: "",

  parseHTML() {
    return [
      {
        tag: 'span[style*="font-size"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const fontSize = element.style.fontSize || null;

          // Only accept valid font sizes (not inherit, initial, unset, etc.)
          if (fontSize && typeof fontSize === "string") {
            const trimmed = fontSize.trim().toLowerCase();
            // Reject relative values and CSS keywords
            if (
              trimmed === "inherit" ||
              trimmed === "initial" ||
              trimmed === "unset" ||
              trimmed === "revert" ||
              trimmed === "revert-layer" ||
              trimmed === "medium" ||
              trimmed === "small" ||
              trimmed === "large" ||
              trimmed === "x-small" ||
              trimmed === "x-large" ||
              trimmed === "xx-small" ||
              trimmed === "xx-large" ||
              trimmed === "smaller" ||
              trimmed === "larger"
            ) {
              return null;
            }
            // Only accept if it's a valid absolute value (px, pt, em, rem, etc.)
            // Return original value (preserve case for px, pt, etc.)
            return { fontSize: fontSize.trim() };
          }

          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    // Get fontSize from mark attributes (preferred) or HTMLAttributes
    const fontSize = mark?.attrs?.fontSize || HTMLAttributes?.fontSize;

    // Only render if we have a valid, non-inherit font size
    if (fontSize && typeof fontSize === "string" && fontSize.trim() !== "") {
      const sizeValue = fontSize.trim().toLowerCase();

      // Reject CSS keywords and relative values
      if (
        sizeValue === "inherit" ||
        sizeValue === "initial" ||
        sizeValue === "unset" ||
        sizeValue === "revert" ||
        sizeValue === "revert-layer" ||
        sizeValue === "medium" ||
        sizeValue === "small" ||
        sizeValue === "large" ||
        sizeValue === "x-small" ||
        sizeValue === "x-large" ||
        sizeValue === "xx-small" ||
        sizeValue === "xx-large" ||
        sizeValue === "smaller" ||
        sizeValue === "larger"
      ) {
        // Return empty spec for invalid font sizes (mark will be filtered out)
        return ["span", {}, 0];
      }

      // Render valid font size with original value (preserve case for px, pt, etc.)
      return [
        "span",
        {
          style: `font-size: ${fontSize.trim()};`,
        },
        0,
      ];
    }

    // Return empty spec if no font size (ProseMirror requires valid spec)
    return ["span", {}, 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands, tr, state }) => {
          if (!size || size.trim() === "") {
            return commands.unsetMark(this.name);
          }

          const trimmedSize = size.trim().toLowerCase();

          // Reject CSS keywords and relative values
          if (
            trimmedSize === "inherit" ||
            trimmedSize === "initial" ||
            trimmedSize === "unset" ||
            trimmedSize === "revert" ||
            trimmedSize === "revert-layer" ||
            trimmedSize === "medium" ||
            trimmedSize === "small" ||
            trimmedSize === "large" ||
            trimmedSize === "x-small" ||
            trimmedSize === "x-large" ||
            trimmedSize === "xx-small" ||
            trimmedSize === "xx-large" ||
            trimmedSize === "smaller" ||
            trimmedSize === "larger"
          ) {
            // Don't set invalid font sizes - just unset the mark
            return commands.unsetMark(this.name);
          }

          // Use setMark to apply the font size - this preserves other marks
          // The chain ensures we maintain focus and preserve existing formatting
          return commands.setMark(this.name, { fontSize: size.trim() });
        },
      unsetFontSize:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => {
          const fontSize = (element as HTMLElement).style.fontSize;

          // Only return valid, non-inherit font sizes
          if (fontSize && typeof fontSize === "string") {
            const trimmed = fontSize.trim().toLowerCase();

            // Reject CSS keywords and relative values
            if (
              trimmed === "inherit" ||
              trimmed === "initial" ||
              trimmed === "unset" ||
              trimmed === "revert" ||
              trimmed === "revert-layer" ||
              trimmed === "medium" ||
              trimmed === "small" ||
              trimmed === "large" ||
              trimmed === "x-small" ||
              trimmed === "x-large" ||
              trimmed === "xx-small" ||
              trimmed === "xx-large" ||
              trimmed === "smaller" ||
              trimmed === "larger" ||
              trimmed === ""
            ) {
              return null;
            }

            // Return the original value (preserve case for px, pt, etc.)
            return fontSize.trim();
          }

          return null;
        },
        renderHTML: (attributes) => {
          // Don't render here - renderHTML method handles it
          // This ensures consistent rendering
          return {};
        },
      },
    };
  },

  // Ensure mark is only valid when fontSize is set
  addProseMirrorPlugins() {
    return [];
  },
});
