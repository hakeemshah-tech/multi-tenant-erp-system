import { Mark } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    /**
     * Set the text color
     */
    setColor: (color: string) => ReturnType;
    /**
     * Unset the text color
     */
    unsetColor: () => ReturnType;
  }
}

export const Color = Mark.create({
  name: "color",

  inclusive: true,
  // Don't exclude any marks - color should work with bold, italic, font size, etc.
  excludes: "",

  parseHTML() {
    return [
      {
        tag: 'span[style*="color"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const color = element.style.color || null;

          // Only accept valid color values
          if (color && typeof color === "string") {
            const trimmed = color.trim().toLowerCase();
            // Reject CSS keywords that don't represent actual colors
            if (
              trimmed === "inherit" ||
              trimmed === "initial" ||
              trimmed === "unset" ||
              trimmed === "revert" ||
              trimmed === "revert-layer" ||
              trimmed === "transparent"
            ) {
              return null;
            }
            // Accept valid color values (hex, rgb, rgba, named colors, etc.)
            return { color: color.trim() };
          }

          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    // Get color from mark attributes (preferred) or HTMLAttributes
    const color = mark?.attrs?.color || HTMLAttributes?.color;

    // Only render if we have a valid color
    if (color && typeof color === "string" && color.trim() !== "") {
      const colorValue = color.trim().toLowerCase();

      // Reject CSS keywords that don't represent actual colors
      if (
        colorValue === "inherit" ||
        colorValue === "initial" ||
        colorValue === "unset" ||
        colorValue === "revert" ||
        colorValue === "revert-layer" ||
        colorValue === "transparent"
      ) {
        // Return empty spec for invalid colors (mark will be filtered out)
        return ["span", {}, 0];
      }

      // Render valid color with original value
      return [
        "span",
        {
          style: `color: ${color.trim()};`,
        },
        0,
      ];
    }

    // Return empty spec if no color (ProseMirror requires valid spec)
    return ["span", {}, 0];
  },

  addCommands() {
    return {
      setColor:
        (color: string) =>
        ({ commands }) => {
          if (!color || color.trim() === "") {
            return commands.unsetMark(this.name);
          }

          const trimmedColor = color.trim().toLowerCase();

          // Reject CSS keywords that don't represent actual colors
          if (
            trimmedColor === "inherit" ||
            trimmedColor === "initial" ||
            trimmedColor === "unset" ||
            trimmedColor === "revert" ||
            trimmedColor === "revert-layer" ||
            trimmedColor === "transparent"
          ) {
            // Don't set invalid colors - just unset the mark
            return commands.unsetMark(this.name);
          }

          // Use setMark to apply the color - this preserves other marks
          return commands.setMark(this.name, { color: color.trim() });
        },
      unsetColor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const color = (element as HTMLElement).style.color;

          // Only return valid, non-inherit colors
          if (color && typeof color === "string") {
            const trimmed = color.trim().toLowerCase();

            // Reject CSS keywords that don't represent actual colors
            if (
              trimmed === "inherit" ||
              trimmed === "initial" ||
              trimmed === "unset" ||
              trimmed === "revert" ||
              trimmed === "revert-layer" ||
              trimmed === "transparent" ||
              trimmed === ""
            ) {
              return null;
            }

            // Return the original value
            return color.trim();
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

  // Ensure mark is only valid when color is set
  addProseMirrorPlugins() {
    return [];
  },
});
