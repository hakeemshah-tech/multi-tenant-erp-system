import { Node, mergeAttributes } from "@tiptap/core";

export interface FieldTokenOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fieldToken: {
      /**
       * Insert a field token
       */
      insertFieldToken: (placeholder: string, label: string) => ReturnType;
    };
  }
}

export const FieldToken = Node.create<FieldTokenOptions>({
  name: "fieldToken",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      placeholder: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-placeholder"),
        renderHTML: (attributes) => {
          if (!attributes.placeholder) {
            return {};
          }
          return {
            "data-placeholder": attributes.placeholder,
          };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }
          return {
            "data-label": attributes.label,
          };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element) => {
          const el = element as HTMLElement;

          // First check the element's own inline style attribute
          const styleAttr = el.getAttribute("style");
          if (styleAttr) {
            const match = styleAttr.match(/font-size:\s*([^;]+)/i);
            if (match && match[1]) {
              return match[1].trim();
            }
          }

          // Also check the computed style (in case it's set via CSS)
          if (el.style && el.style.fontSize) {
            return el.style.fontSize;
          }

          // Check parent element for font-size (TipTap may wrap atom nodes)
          const parent = el.parentElement;
          if (parent && parent.tagName === "SPAN") {
            const parentStyle = parent.getAttribute("style");
            if (parentStyle) {
              const match = parentStyle.match(/font-size:\s*([^;]+)/i);
              if (match && match[1]) {
                return match[1].trim();
              }
            }
          }

          return null;
        },
        renderHTML: (attributes) => {
          // Font size is rendered in the main renderHTML method, not here
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-placeholder]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          const element = node as HTMLElement;
          return element.classList.contains("field-token") ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const placeholder =
      HTMLAttributes["data-placeholder"] || HTMLAttributes.placeholder;
    const label =
      HTMLAttributes["data-label"] ||
      HTMLAttributes.label ||
      placeholder
        ?.replace(/^\{\{|\}\}$/g, "")
        .split(".")
        .pop() ||
      "Field";

    // Get font size from node attributes (stored during insertion) or HTMLAttributes
    const fontSize = node?.attrs?.fontSize || HTMLAttributes?.fontSize;

    // Build style attribute - preserve font size if present
    const styleParts: string[] = [];
    if (fontSize && typeof fontSize === "string" && fontSize.trim() !== "") {
      styleParts.push(`font-size: ${fontSize.trim()}`);
    }
    const styleAttr = styleParts.length > 0 ? styleParts.join("; ") : undefined;

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, {
        class:
          "field-token inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1",
        "data-placeholder": placeholder,
        "data-label": label,
        contenteditable: "false",
        ...(styleAttr ? { style: styleAttr } : {}),
      }),
      ["span", { class: "field-token-label" }, label],
    ];
  },

  addCommands() {
    return {
      insertFieldToken:
        (placeholder: string, label: string) =>
        ({ commands, state }) => {
          // Check for active font size mark at the insertion point
          const { selection } = state;
          const { $from } = selection;
          let fontSize: string | null = null;

          // Check if there's an active fontSize mark at the cursor position
          const marks = $from.marks();
          for (const mark of marks) {
            if (
              mark.type.name === "fontSize" &&
              mark.attrs &&
              mark.attrs.fontSize
            ) {
              fontSize = mark.attrs.fontSize;
              break;
            }
          }

          // If no mark found, check the stored marks in the state
          if (!fontSize) {
            const storedMarks = state.storedMarks || $from.marksAcross() || [];
            for (const mark of storedMarks) {
              if (
                mark.type.name === "fontSize" &&
                mark.attrs &&
                mark.attrs.fontSize
              ) {
                fontSize = mark.attrs.fontSize;
                break;
              }
            }
          }

          // If still no mark found, check the node before the cursor
          if (!fontSize && $from.nodeBefore) {
            const beforeMarks = $from.nodeBefore.marks || [];
            for (const mark of beforeMarks) {
              if (
                mark.type.name === "fontSize" &&
                mark.attrs &&
                mark.attrs.fontSize
              ) {
                fontSize = mark.attrs.fontSize;
                break;
              }
            }
          }

          // Insert the field token with font size if found
          return commands.insertContent({
            type: this.name,
            attrs: {
              placeholder,
              label,
              ...(fontSize ? { fontSize } : {}),
            },
          });
        },
    };
  },
});
