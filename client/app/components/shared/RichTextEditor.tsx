"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { Button } from "rizzui";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  className?: string;
  spellCheck?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  label,
  multiline = true,
  className = "",
  spellCheck = true,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize and update content when value prop changes
  useEffect(() => {
    if (editorRef.current) {
      // If value is plain text (no HTML tags), convert it to HTML
      let htmlValue = value || "";
      if (value && !value.includes("<") && !value.includes("&")) {
        // Plain text - convert newlines to <br> and escape HTML
        htmlValue = value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
      }

      const currentHTML = editorRef.current.innerHTML;
      // Only update if different and editor is not focused to avoid cursor jumping
      if (currentHTML !== htmlValue && !isFocused) {
        editorRef.current.innerHTML = htmlValue;
      }
    }
  }, [value, isFocused]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  }, [onChange]);

  // Handle paste - strip formatting to keep it clean
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      handleInput();
    },
    [handleInput]
  );

  // Formatting commands (scoped to this editor instance)
  const execCommand = useCallback(
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
                    (line) => line.trim() !== "" || selectedText.includes("\n")
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

  return (
    <div className={`rich-text-editor ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border border-gray-300 rounded-t-md bg-gray-50">
        <Button
          type="button"
          size="sm"
          variant={isFormatActive("bold") ? "solid" : "outline"}
          onClick={() => execCommand("bold")}
          className="h-7 w-7 p-0"
          title="Bold"
        >
          <Bold size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isFormatActive("italic") ? "solid" : "outline"}
          onClick={() => execCommand("italic")}
          className="h-7 w-7 p-0"
          title="Italic"
        >
          <Italic size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isFormatActive("underline") ? "solid" : "outline"}
          onClick={() => execCommand("underline")}
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
          onClick={() => execCommand("insertUnorderedList")}
          className="h-7 w-7 p-0"
          title="Bullet List"
        >
          <List size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => execCommand("insertOrderedList")}
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
        } ${isFocused ? "bg-white" : "bg-white"}`}
        style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          lineHeight: "1.5",
          spellCheck: spellCheck,
        }}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        data-placeholder={placeholder}
        spellCheck={spellCheck}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {!value && placeholder && !isFocused && (
        <div
          className="absolute pointer-events-none text-gray-400 px-3 py-2"
          style={{ marginTop: multiline ? "8rem" : "4rem" }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};
