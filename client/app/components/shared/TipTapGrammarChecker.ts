import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Common grammar patterns and suggestions for contract templates
const GRAMMAR_PATTERNS = [
  {
    pattern: /\b(employee|employer|organization)\s+(is|are)\s+/gi,
    suggestion:
      'Consider using "the employee", "the employer", or "the organization" for clarity',
    type: "grammar",
  },
  {
    pattern: /\b(shall|will)\s+(be|have|do)\s+/gi,
    suggestion:
      'In legal documents, "shall" is preferred over "will" for obligations',
    type: "style",
  },
  {
    pattern: /\b(can't|cannot)\s+/gi,
    suggestion:
      'Use "may not" or "shall not" in formal contracts instead of "cannot"',
    type: "style",
  },
  {
    pattern: /\b(don't|doesn't|won't)\s+/gi,
    suggestion: 'Use "do not", "does not", or "will not" in formal contracts',
    type: "style",
  },
  {
    pattern: /\b(its|it's)\s+/gi,
    suggestion: 'Ensure correct usage: "its" (possessive) vs "it\'s" (it is)',
    type: "grammar",
  },
  {
    pattern: /\b(their|there|they're)\s+/gi,
    suggestion:
      'Ensure correct usage: "their" (possessive), "there" (location), "they\'re" (they are)',
    type: "grammar",
  },
  {
    pattern: /\b(affect|effect)\s+/gi,
    suggestion: 'Ensure correct usage: "affect" (verb) vs "effect" (noun)',
    type: "grammar",
  },
];

export interface GrammarCheckerOptions {
  enabled?: boolean;
}

export const GrammarChecker = Extension.create<GrammarCheckerOptions>({
  name: "grammarChecker",

  addOptions() {
    return {
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey("grammarChecker"),
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set, oldState, newState) {
            // Check if enabled state changed (by checking if options were updated)
            const wasEnabled =
              oldState && (oldState as any).__grammarCheckEnabled;
            const isEnabled = options.enabled;
            const enabledChanged = wasEnabled !== isEnabled;

            // Store current enabled state
            (newState as any).__grammarCheckEnabled = isEnabled;

            if (!options.enabled) {
              // If disabled, clear all decorations
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            const { doc } = newState;

            // Re-check if document changed OR if enabled state changed
            if (
              !tr.docChanged &&
              !enabledChanged &&
              set !== DecorationSet.empty
            ) {
              return set;
            }

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const text = node.text;

                // Check grammar patterns
                GRAMMAR_PATTERNS.forEach(({ pattern, suggestion, type }) => {
                  let match;
                  const regex = new RegExp(pattern.source, pattern.flags);

                  while ((match = regex.exec(text)) !== null) {
                    const from = pos + match.index;
                    const to = from + match[0].length;

                    decorations.push(
                      Decoration.inline(from, to, {
                        class: `grammar-check grammar-${type}`,
                        "data-suggestion": suggestion,
                        title: suggestion,
                      })
                    );
                  }
                });
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
