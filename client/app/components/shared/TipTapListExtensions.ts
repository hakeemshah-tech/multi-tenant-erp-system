import { BulletList as BaseBulletList } from "@tiptap/extension-bullet-list";
import { OrderedList as BaseOrderedList } from "@tiptap/extension-ordered-list";

// Custom BulletList extension with listStyleType support
export const BulletList = BaseBulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyleType: {
        default: "disc",
        parseHTML: (element) => {
          const style = element.getAttribute("style");
          const match = style?.match(/list-style-type:\s*([^;]+)/);
          return match
            ? match[1].trim()
            : element.getAttribute("data-list-style-type") || "disc";
        },
        renderHTML: (attributes) => {
          if (
            !attributes.listStyleType ||
            attributes.listStyleType === "disc"
          ) {
            return {};
          }
          return {
            "data-list-style-type": attributes.listStyleType,
            style: `list-style-type: ${attributes.listStyleType}`,
          };
        },
      },
    };
  },
  addCommands() {
    const parentCommands = this.parent?.();
    const parentToggle = parentCommands?.toggleBulletList;
    return {
      ...parentCommands,
      toggleBulletList:
        (options?: { listStyleType?: string }) =>
        ({ commands, chain, state, dispatch, tr }) => {
          // Check if bulletList is active by checking the selection
          const { selection } = state;
          const { $from } = selection;
          let isActive = false;

          // Walk up the node tree to find if we're in a bulletList
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === "bulletList") {
              isActive = true;
              break;
            }
          }

          if (isActive) {
            if (options?.listStyleType) {
              // Just update the style without toggling
              return chain()
                .updateAttributes("bulletList", {
                  listStyleType: options.listStyleType,
                })
                .run();
            }
            // No style specified, toggle off - use liftListItem to convert list items to paragraphs
            return chain().liftListItem("listItem").run();
          }
          // Not active, create new list with specified style using parent command
          const style = options?.listStyleType || "disc";
          if (parentToggle) {
            // Use parent command to create the list, then update attributes
            const result = parentToggle()({
              commands,
              chain,
              state,
              dispatch,
              tr,
            });
            if (result && style !== "disc") {
              // Update attributes after creating the list
              return chain()
                .updateAttributes("bulletList", { listStyleType: style })
                .run();
            }
            return result;
          }
          // Fallback: use wrapIn if parent command not available
          return chain().wrapIn(this.type, { listStyleType: style }).run();
        },
    };
  },
});

// Custom OrderedList extension with listStyleType support
export const OrderedList = BaseOrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyleType: {
        default: "decimal",
        parseHTML: (element) => {
          const style = element.getAttribute("style");
          const match = style?.match(/list-style-type:\s*([^;]+)/);
          return match
            ? match[1].trim()
            : element.getAttribute("data-list-style-type") || "decimal";
        },
        renderHTML: (attributes) => {
          if (
            !attributes.listStyleType ||
            attributes.listStyleType === "decimal"
          ) {
            return {};
          }
          return {
            "data-list-style-type": attributes.listStyleType,
            style: `list-style-type: ${attributes.listStyleType}`,
          };
        },
      },
    };
  },
  addCommands() {
    const parentCommands = this.parent?.();
    const parentToggle = parentCommands?.toggleOrderedList;
    return {
      ...parentCommands,
      toggleOrderedList:
        (options?: { listStyleType?: string }) =>
        ({ commands, chain, state, dispatch, tr }) => {
          // Check if orderedList is active by checking the selection
          const { selection } = state;
          const { $from } = selection;
          let isActive = false;

          // Walk up the node tree to find if we're in an orderedList
          for (let depth = $from.depth; depth > 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === "orderedList") {
              isActive = true;
              break;
            }
          }

          if (isActive) {
            if (options?.listStyleType) {
              // Just update the style without toggling
              return chain()
                .updateAttributes("orderedList", {
                  listStyleType: options.listStyleType,
                })
                .run();
            }
            // No style specified, toggle off - use liftListItem to convert list items to paragraphs
            return chain().liftListItem("listItem").run();
          }
          // Not active, create new list with specified style using parent command
          const style = options?.listStyleType || "decimal";
          if (parentToggle) {
            // Use parent command to create the list, then update attributes
            const result = parentToggle()({
              commands,
              chain,
              state,
              dispatch,
              tr,
            });
            if (result && style !== "decimal") {
              // Update attributes after creating the list
              return chain()
                .updateAttributes("orderedList", { listStyleType: style })
                .run();
            }
            return result;
          }
          // Fallback: use wrapIn if parent command not available
          return chain().wrapIn(this.type, { listStyleType: style }).run();
        },
    };
  },
});
