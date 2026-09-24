"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { X, Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { Button } from "rizzui";

export interface FieldToken {
  id: string;
  placeholder: string; // e.g., "{{employee.lastname}}"
  label: string; // e.g., "Last Name"
  startIndex: number;
  endIndex: number;
}

interface FieldTokenEditorProps {
  value: string; // Text with placeholders like "Hello {{employee.name}} world"
  onChange: (newValue: string) => void;
  getFieldLabel: (fieldRef: string) => string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  label?: string;
}

export interface FieldTokenEditorRef {
  insertPlaceholder: (placeholder: string) => void;
  focus: () => void;
}

export const FieldTokenEditor = forwardRef<
  FieldTokenEditorRef,
  FieldTokenEditorProps
>(
  (
    {
      value,
      onChange,
      getFieldLabel,
      placeholder,
      className = "",
      multiline = false,
      label,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isComposing, setIsComposing] = useState(false);

    // Convert placeholder text to HTML with badges (preserving existing HTML formatting)
    const valueToHTML = useCallback(
      (text: string): string => {
        if (!text) return "";

        // Normalize: Add spaces between adjacent placeholders if they're concatenated
        // This handles cases like "{{a}}{{b}}" -> "{{a}} {{b}}"
        text = text.replace(/(\}\})(\{\{)/g, "$1 $2");

        // If text already contains HTML (not just placeholders), parse it
        if (text.includes("<") && !text.match(/^\{\{/)) {
          // Text contains HTML - first normalize by converting any existing badges to placeholders
          const temp = document.createElement("div");
          temp.innerHTML = text;

          // Remove any existing field-token badges and convert them to placeholder text first
          // This prevents duplicates when we process placeholders below
          temp.querySelectorAll(".field-token").forEach((badge) => {
            const placeholder = badge.getAttribute("data-placeholder");
            if (placeholder) {
              const textNode = document.createTextNode(placeholder);
              badge.parentNode?.replaceChild(textNode, badge);
            } else {
              badge.remove();
            }
          });

          // Now find all text nodes and process placeholders
          const walker = document.createTreeWalker(
            temp,
            NodeFilter.SHOW_TEXT,
            null
          );

          const textNodes: {
            node: Node;
            placeholder: string;
            match: RegExpExecArray;
          }[] = [];
          let node;
          while ((node = walker.nextNode())) {
            const textContent = node.textContent || "";
            const regex = /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
            let match;
            while ((match = regex.exec(textContent)) !== null) {
              textNodes.push({ node, placeholder: match[0], match });
            }
          }

          // Replace placeholders with badges (in reverse order to maintain indices)
          textNodes.reverse().forEach(({ node, placeholder, match }) => {
            const parent = node.parentElement;
            if (!parent) return;

            const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
            const label = getFieldLabel(inner);

            const badge = document.createElement("span");
            badge.className =
              "field-token inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1";
            badge.setAttribute("data-placeholder", placeholder);
            badge.setAttribute("contenteditable", "false");
            // Render label only; no remove button to avoid stray "X" characters
            badge.innerHTML = `<span class="field-token-label">${escapeHtml(label)}</span>`;

            // Split text node and insert badge
            const textNode = node as Text;
            const beforeText =
              textNode.textContent?.substring(0, match.index) || "";
            const afterText =
              textNode.textContent?.substring(match.index + match[0].length) ||
              "";

            if (beforeText) {
              const beforeNode = document.createTextNode(beforeText);
              parent.insertBefore(beforeNode, textNode);
            }
            parent.insertBefore(badge, textNode);
            if (afterText) {
              const afterNode = document.createTextNode(afterText);
              parent.insertBefore(afterNode, textNode);
            }
            parent.removeChild(textNode);
          });

          return temp.innerHTML;
        }

        // Plain text with placeholders - convert to HTML with badges
        const regex = /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let html = "";
        let tokenId = 0;

        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = regex.lastIndex;

          // Add text before token (preserve newlines as <br>)
          if (start > lastIndex) {
            const textBefore = text.slice(lastIndex, start);
            html += escapeHtml(textBefore).replace(/\n/g, "<br>");
          }

          // Create badge for token
          const placeholder = match[0];
          const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
          const label = getFieldLabel(inner);
          const id = `token-${tokenId++}`;

          // Render label only; no remove button to avoid stray "X" characters
          html += `<span class="field-token inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1" data-placeholder="${escapeHtml(placeholder)}" data-token-id="${id}" contenteditable="false"><span class="field-token-label">${escapeHtml(label)}</span></span>`;

          lastIndex = end;
        }

        // Add remaining text (preserve newlines as <br>)
        if (lastIndex < text.length) {
          const textAfter = text.slice(lastIndex);
          html += escapeHtml(textAfter).replace(/\n/g, "<br>");
        }

        return html;
      },
      [getFieldLabel]
    );

    // Convert HTML back to placeholder text (preserving HTML formatting)
    const htmlToValue = useCallback((html: string): string => {
      if (!html) return "";

      // Create a temporary div to parse HTML
      const temp = document.createElement("div");
      temp.innerHTML = html;

      // Remove all buttons first to prevent any text leakage
      temp
        .querySelectorAll('button[data-remove-button="true"]')
        .forEach((btn) => {
          btn.remove();
        });

      // Also remove any buttons inside field-token badges (safety measure)
      temp.querySelectorAll(".field-token button").forEach((btn) => {
        btn.remove();
      });

      // Replace field-token badges with placeholders while preserving other HTML
      // IMPORTANT: Process in reverse order to maintain correct indices
      const badges = Array.from(
        temp.querySelectorAll(".field-token")
      ).reverse();
      const badgePlaceholders = new Set<string>();
      badges.forEach((badge) => {
        const placeholder = badge.getAttribute("data-placeholder");
        if (placeholder) {
          badgePlaceholders.add(placeholder);
          // Use the placeholder attribute value directly, not textContent
          const textNode = document.createTextNode(placeholder);
          badge.parentNode?.replaceChild(textNode, badge);
        } else {
          badge.remove();
        }
      });

      // Clean up any stray '✕' characters that might have leaked
      const walker = document.createTreeWalker(
        temp,
        NodeFilter.SHOW_TEXT,
        null
      );

      const textNodes: Text[] = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node as Text);
        }
      }

      // Remove '✕' characters from ALL text nodes (buttons should already be removed)
      textNodes.forEach((textNode) => {
        if (textNode.textContent?.includes("✕")) {
          textNode.textContent = textNode.textContent.replace(/✕/g, "").trim();
          // Remove empty text nodes
          if (!textNode.textContent) {
            textNode.remove();
          }
        }
      });

      // Merge adjacent text nodes, but preserve spacing between placeholders
      const allNodes = Array.from(temp.childNodes);
      for (let i = 0; i < allNodes.length - 1; i++) {
        const current = allNodes[i];
        const next = allNodes[i + 1];
        if (
          current.nodeType === Node.TEXT_NODE &&
          next.nodeType === Node.TEXT_NODE
        ) {
          const currentText = current.textContent || "";
          const nextText = next.textContent || "";

          // Check if both are placeholders - if so, add a space between them
          const placeholderRegex =
            /\{\{(employee|custom|organization)\.[^}]+\}\}/;
          const currentIsPlaceholder = placeholderRegex.test(
            currentText.trim()
          );
          const nextIsPlaceholder = placeholderRegex.test(nextText.trim());

          if (currentIsPlaceholder && nextIsPlaceholder) {
            // Both are placeholders - ensure there's at least a space between them
            const separator =
              currentText.endsWith("}") && nextText.startsWith("{") ? " " : "";
            current.textContent = currentText + separator + nextText;
          } else {
            // At least one is not a placeholder - merge normally
            current.textContent = currentText + nextText;
          }

          next.remove();
          allNodes.splice(i + 1, 1);
          i--; // Recheck this position
        }
      }

      // Return the HTML with badges replaced by placeholders
      // This should now only contain placeholder text, not duplicate badges
      return temp.innerHTML;
    }, []);

    // Escape HTML
    const escapeHtml = (text: string): string => {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    // Update HTML when value changes (only if editor content doesn't match)
    useEffect(() => {
      if (!editorRef.current) return;

      // Get current editor content and convert to value
      const currentHTML = editorRef.current.innerHTML;
      const currentValue = htmlToValue(currentHTML);

      // Only update if the value prop changed externally (not from user input)
      // Use a more lenient comparison to avoid unnecessary updates
      const normalizedCurrent = currentValue.trim();
      const normalizedValue = (value || "").trim();

      if (normalizedCurrent !== normalizedValue) {
        // Save cursor position before updating
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const cursorOffset =
          range && editorRef.current.contains(range.commonAncestorContainer)
            ? getCursorOffset(editorRef.current, range)
            : null;

        // Update editor content
        const newHTML = valueToHTML(value || "");
        editorRef.current.innerHTML = newHTML;

        // Ensure all badges are properly styled and non-editable
        editorRef.current.querySelectorAll(".field-token").forEach((badge) => {
          const el = badge as HTMLElement;
          el.setAttribute("contenteditable", "false");
          el.style.display = "inline-flex";
          el.style.userSelect = "none";
        });

        // Restore cursor position
        if (cursorOffset !== null && cursorOffset >= 0) {
          setTimeout(() => {
            restoreCursorPosition(editorRef.current!, cursorOffset);
          }, 0);
        }
      }
    }, [value, valueToHTML, htmlToValue]);

    // Get cursor offset in text
    const getCursorOffset = (container: HTMLElement, range: Range): number => {
      let offset = 0;
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while ((node = walker.nextNode())) {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);

        if (node === range.startContainer) {
          offset += range.startOffset;
          return offset;
        }

        if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) > 0) {
          offset += node.textContent?.length || 0;
        } else {
          break;
        }
      }

      return offset;
    };

    // Restore cursor position
    const restoreCursorPosition = (container: HTMLElement, offset: number) => {
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let currentOffset = 0;
      let node;
      while ((node = walker.nextNode())) {
        const textLength = node.textContent?.length || 0;
        if (currentOffset + textLength >= offset) {
          const range = document.createRange();
          const selection = window.getSelection();
          range.setStart(node, offset - currentOffset);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
          return;
        }
        currentOffset += textLength;
      }
    };

    // Handle input changes
    const handleInput = useCallback(() => {
      if (!editorRef.current || isComposing) return;

      const editor = editorRef.current;
      // Ensure any legacy buttons are removed from DOM before extracting value
      editor
        .querySelectorAll(".field-token button")
        .forEach((btn) => btn.remove());

      const html = editor.innerHTML;
      const newValue = htmlToValue(html);

      if (newValue !== value) {
        onChange(newValue);
      }
    }, [value, onChange, htmlToValue, isComposing]);

    // Handle paste - preserve formatting but clean up
    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text/plain");
        const selection = window.getSelection();

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(pastedText);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);

          handleInput();
        }
      },
      [handleInput]
    );

    // Formatting commands for rich text (scoped to this editor instance)
    const execFormatCommand = useCallback(
      (command: string, value: string | boolean = false) => {
        const editor = editorRef.current;
        if (!editor) return;

        // Ensure this editor is focused before applying command
        editor.focus();

        // Get current selection within this editor
        let selection = window.getSelection();
        let range: Range | null = null;

        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
          // Check if selection is within this editor
          if (!editor.contains(range.commonAncestorContainer)) {
            // Selection is not in this editor, create a new range at the end
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          // No selection, create range at the end of editor
          range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false); // Collapse to end
          selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        // Special handling for list commands (Google Docs-like behavior)
        if (
          command === "insertUnorderedList" ||
          command === "insertOrderedList"
        ) {
          if (range && selection) {
            // Check if we're already in a list
            let container: Node | null = range.commonAncestorContainer;
            if (container && container.nodeType === Node.TEXT_NODE) {
              container = container.parentElement;
            }

            const isInList =
              container &&
              container instanceof HTMLElement &&
              (container.tagName === "UL" ||
                container.tagName === "OL" ||
                container.closest("ul, ol"));

            if (isInList) {
              // Already in a list - toggle it off or change list type
              const currentList =
                container instanceof HTMLElement
                  ? (container.closest("ul, ol") as HTMLElement)
                  : null;
              if (currentList) {
                const isCurrentType =
                  (command === "insertUnorderedList" &&
                    currentList.tagName === "UL") ||
                  (command === "insertOrderedList" &&
                    currentList.tagName === "OL");
                if (isCurrentType) {
                  // Toggle off - convert list items back to paragraphs
                  const listItems = Array.from(
                    currentList.querySelectorAll("li")
                  );
                  const fragment = document.createDocumentFragment();

                  listItems.forEach((li, index) => {
                    const p = document.createElement("p");
                    p.textContent = li.textContent || "";
                    if (li.innerHTML) {
                      p.innerHTML = li.innerHTML;
                    }
                    fragment.appendChild(p);
                    if (index < listItems.length - 1) {
                      fragment.appendChild(document.createElement("br"));
                    }
                  });

                  currentList.parentNode?.replaceChild(fragment, currentList);
                } else {
                  // Change list type
                  const newListTag =
                    command === "insertUnorderedList" ? "ul" : "ol";
                  const newList = document.createElement(newListTag);
                  newList.innerHTML = currentList.innerHTML;
                  currentList.parentNode?.replaceChild(newList, currentList);
                }
              }
            } else {
              // Not in a list - create one from selected text
              // Try using execCommand first (works best for multi-line selections)
              selection.removeAllRanges();
              selection.addRange(range);

              const success = document.execCommand(command, false, undefined);

              if (!success) {
                // Fallback: manual list creation
                const listTag = command === "insertUnorderedList" ? "ul" : "ol";
                const list = document.createElement(listTag);

                if (range.collapsed || range.toString().trim() === "") {
                  // No selection - create empty list item
                  const listItem = document.createElement("li");
                  listItem.innerHTML = "<br>";
                  list.appendChild(listItem);
                  range.insertNode(list);

                  // Set cursor inside the list item
                  const newRange = document.createRange();
                  newRange.setStart(listItem, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                } else {
                  // Has selection - convert to list items (Google Docs style)
                  const selectedText = range.toString();
                  const lines = selectedText
                    .split(/\r?\n/)
                    .filter(
                      (line) =>
                        line.trim() !== "" || selectedText.includes("\n")
                    );

                  if (lines.length === 0 || lines.length === 1) {
                    // Single line selection
                    const contents = range.extractContents();
                    const listItem = document.createElement("li");
                    if (contents.textContent) {
                      listItem.textContent = contents.textContent;
                    } else {
                      // Preserve HTML formatting
                      listItem.appendChild(contents);
                    }
                    if (listItem.innerHTML.trim() === "") {
                      listItem.innerHTML = "<br>";
                    }
                    list.appendChild(listItem);
                  } else {
                    // Multiple lines - each line becomes a list item
                    const contents = range.extractContents();
                    const tempDiv = document.createElement("div");
                    tempDiv.appendChild(contents);

                    // Split content by line breaks
                    const htmlContent = tempDiv.innerHTML;
                    const lineParts = htmlContent.split(
                      /<br\s*\/?>|<div|<\/div>|<p|<\/p>/i
                    );

                    lineParts.forEach((part) => {
                      const trimmed = part.trim();
                      if (trimmed && !trimmed.match(/^<\/?/)) {
                        const listItem = document.createElement("li");
                        // Try to preserve HTML if it exists
                        if (trimmed.includes("<")) {
                          listItem.innerHTML = trimmed;
                        } else {
                          listItem.textContent = trimmed;
                        }
                        if (listItem.innerHTML.trim() === "") {
                          listItem.innerHTML = "<br>";
                        }
                        list.appendChild(listItem);
                      }
                    });

                    // If parsing failed, use simple line split
                    if (list.children.length === 0) {
                      lines.forEach((line) => {
                        const listItem = document.createElement("li");
                        listItem.textContent = line.trim() || "";
                        if (listItem.textContent === "") {
                          listItem.innerHTML = "<br>";
                        }
                        list.appendChild(listItem);
                      });
                    }
                  }

                  range.insertNode(list);

                  // Set cursor at the end of the last list item
                  const lastItem = list.lastElementChild as HTMLElement;
                  if (lastItem) {
                    const newRange = document.createRange();
                    newRange.selectNodeContents(lastItem);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                  }
                }
              }
            }
          }
        } else {
          // For other commands, use execCommand normally
          document.execCommand(command, false, value as string);
        }

        handleInput();
      },
      [handleInput]
    );

    // Check if format is active (scoped to this editor)
    const isFormatActive = useCallback((command: string): boolean => {
      const editor = editorRef.current;
      if (!editor) return false;

      // Check if editor is focused and selection is within it
      if (document.activeElement === editor) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (editor.contains(range.commonAncestorContainer)) {
            return document.queryCommandState(command);
          }
        }
      }
      return false;
    }, []);

    // Handle keyboard events
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isComposing) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        // Handle Backspace/Delete on badges
        if (e.key === "Backspace" || e.key === "Delete") {
          const range = selection.getRangeAt(0);
          const container = range.startContainer;
          const parent = container.parentElement;

          // Check if we're at the start/end of a badge
          if (parent && parent.classList.contains("field-token")) {
            e.preventDefault();
            e.stopPropagation();
            parent.remove();
            // Clean up any stray text that might have been created
            setTimeout(() => handleInput(), 0);
            return;
          }

          // No buttons exist anymore; nothing extra to handle here

          // Check if selection includes a badge
          const commonAncestor = range.commonAncestorContainer;
          if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
            const element = commonAncestor as HTMLElement;
            if (element.classList.contains("field-token")) {
              e.preventDefault();
              e.stopPropagation();
              element.remove();
              setTimeout(() => handleInput(), 0);
              return;
            }
          }

          // Check if we're about to delete into a badge
          if (e.key === "Backspace" && range.collapsed) {
            const prevSibling =
              range.startContainer.nodeType === Node.TEXT_NODE
                ? range.startContainer.previousSibling
                : (range.startContainer as Element).previousElementSibling;
            if (
              prevSibling &&
              (prevSibling as Element).classList?.contains("field-token")
            ) {
              e.preventDefault();
              e.stopPropagation();
              prevSibling.remove();
              setTimeout(() => handleInput(), 0);
              return;
            }
          }
        }
      },
      [isComposing, handleInput]
    );

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertPlaceholder: (placeholder: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        // Focus the editor first to ensure we can insert
        editor.focus();

        const selection = window.getSelection();
        let range: Range | null = null;

        // Get current selection or create one at the end
        if (selection && selection.rangeCount > 0) {
          const selRange = selection.getRangeAt(0);
          // Check if selection is within this editor
          if (editor.contains(selRange.commonAncestorContainer)) {
            range = selRange;
          }
        }

        // If no valid range, place cursor at the end
        if (!range) {
          range = document.createRange();
          // Try to find the last text node or create a text node at the end
          const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null
          );

          let lastTextNode: Node | null = null;
          let node;
          while ((node = walker.nextNode())) {
            lastTextNode = node;
          }

          if (lastTextNode) {
            range.setStartAfter(lastTextNode);
          } else {
            // No text nodes, insert at end of editor
            range.selectNodeContents(editor);
            range.collapse(false);
          }

          // Update selection
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
        const label = getFieldLabel(inner);

        // Create badge element with proper styling for visibility
        const badge = document.createElement("span");
        badge.className =
          "field-token inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1";
        badge.setAttribute("data-placeholder", placeholder);
        badge.setAttribute("contenteditable", "false");
        badge.style.display = "inline-flex";
        badge.style.userSelect = "none";

        const labelSpan = document.createElement("span");
        labelSpan.className = "field-token-label";
        labelSpan.textContent = label;
        badge.appendChild(labelSpan);

        // Insert badge at the current cursor position
        try {
          // Check if we're inserting right after another badge - if so, add a space
          let needsSpace = false;
          if (range.collapsed) {
            // Check the node before the cursor
            const startContainer = range.startContainer;
            if (startContainer.nodeType === Node.TEXT_NODE) {
              const textNode = startContainer as Text;
              // If cursor is at start of text node, check previous sibling
              if (range.startOffset === 0) {
                const prevSibling = textNode.previousSibling;
                if (
                  prevSibling &&
                  (prevSibling as Element).classList?.contains("field-token")
                ) {
                  needsSpace = true;
                }
              }
            } else {
              // Check previous sibling of the element
              const prevSibling = (startContainer as Element)
                .previousElementSibling;
              if (
                prevSibling &&
                prevSibling.classList.contains("field-token")
              ) {
                needsSpace = true;
              }
            }
          }

          range.deleteContents();

          if (needsSpace) {
            // Insert a space before the badge
            const spaceNode = document.createTextNode(" ");
            range.insertNode(spaceNode);
            range.setStartAfter(spaceNode);
          }

          range.insertNode(badge);

          // Move cursor after the badge
          const newRange = document.createRange();
          if (badge.nextSibling) {
            // If there's a next sibling, position before it
            if (badge.nextSibling.nodeType === Node.TEXT_NODE) {
              newRange.setStart(badge.nextSibling, 0);
            } else {
              newRange.setStartBefore(badge.nextSibling);
            }
          } else {
            // No next sibling, position after badge
            newRange.setStartAfter(badge);
            // Create a text node for cursor positioning if needed
            const textNode = document.createTextNode("");
            badge.parentNode?.insertBefore(textNode, badge.nextSibling);
            newRange.setStart(textNode, 0);
          }
          newRange.collapse(true);

          selection?.removeAllRanges();
          selection?.addRange(newRange);

          // Trigger input to save the change
          handleInput();
        } catch (error) {
          console.error("Error inserting placeholder:", error);
          // Fallback: append at end
          editor.appendChild(badge);
          const fallbackRange = document.createRange();
          fallbackRange.setStartAfter(badge);
          fallbackRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(fallbackRange);
          handleInput();
        }
      },
      focus: () => {
        editorRef.current?.focus();
      },
    }));

    // Initialize editor content and attach click handlers
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      // Set initial content if empty
      if (!editor.innerHTML || editor.innerHTML.trim() === "") {
        editor.innerHTML = valueToHTML(value);
      }

      // Ensure all badges are properly configured
      editor.querySelectorAll(".field-token").forEach((badge) => {
        const el = badge as HTMLElement;
        el.setAttribute("contenteditable", "false");
        el.style.display = "inline-flex";
        el.style.userSelect = "none";
        el.style.cursor = "pointer";
        // Remove any legacy buttons
        el.querySelectorAll("button").forEach((btn) => btn.remove());
      });

      // Handle badge clicks for removal
      const handleBadgeClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const badge = target.closest(".field-token") as HTMLElement | null;
        if (badge && editor.contains(badge)) {
          e.preventDefault();
          e.stopPropagation();

          // Save sibling references before removing
          const nextSibling = badge.nextSibling;
          const prevSibling = badge.previousSibling;
          const parent = badge.parentElement || editor;

          // Remove the badge
          badge.remove();

          // Position cursor after the removed badge's position
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            // Try to position after where the badge was
            if (nextSibling) {
              if (nextSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(nextSibling, 0);
              } else {
                range.setStartBefore(nextSibling);
              }
            } else if (prevSibling) {
              // Position after previous sibling
              if (prevSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(
                  prevSibling,
                  prevSibling.textContent?.length || 0
                );
              } else {
                range.setStartAfter(prevSibling);
              }
            } else {
              // No siblings, position at start of parent
              range.setStart(parent, 0);
            }
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }

          handleInput();
        }
      };

      editor.addEventListener("click", handleBadgeClick);
      return () => editor.removeEventListener("click", handleBadgeClick);
    }, [valueToHTML, handleInput]);

    return (
      <div className={`field-token-editor relative ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

        {/* Rich Text Toolbar */}
        <div className="flex items-center gap-1 p-2 border border-gray-300 rounded-t-md bg-gray-50">
          <Button
            type="button"
            size="sm"
            variant={isFormatActive("bold") ? "solid" : "outline"}
            onClick={() => execFormatCommand("bold")}
            className="h-7 w-7 p-0"
            title="Bold"
          >
            <Bold size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isFormatActive("italic") ? "solid" : "outline"}
            onClick={() => execFormatCommand("italic")}
            className="h-7 w-7 p-0"
            title="Italic"
          >
            <Italic size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isFormatActive("underline") ? "solid" : "outline"}
            onClick={() => execFormatCommand("underline")}
            className="h-7 w-7 p-0"
            title="Underline"
          >
            <Underline size={14} />
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => execFormatCommand("insertUnorderedList")}
            className="h-7 w-7 p-0"
            title="Bullet List"
          >
            <List size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => execFormatCommand("insertOrderedList")}
            className="h-7 w-7 p-0"
            title="Numbered List"
          >
            <ListOrdered size={14} />
          </Button>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={`w-full px-3 py-2 border border-t-0 border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            multiline ? "min-h-[6rem]" : "min-h-[2.5rem]"
          } resize-none`}
          style={{
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "1.5",
          }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          data-placeholder={placeholder}
          spellCheck={true}
        />
        {!value && placeholder && (
          <div
            className="absolute pointer-events-none text-gray-400 px-3 py-2"
            style={{ marginTop: multiline ? "8rem" : "4rem" }}
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  }
);

FieldTokenEditor.displayName = "FieldTokenEditor";
