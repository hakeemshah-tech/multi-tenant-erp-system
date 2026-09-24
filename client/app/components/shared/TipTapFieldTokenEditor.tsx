"use client";

import React, {
  useImperativeHandle,
  forwardRef,
  useEffect,
  useState,
  Fragment,
  useRef,
  useCallback,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import "./tiptap.css";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { FieldToken } from "./TipTapFieldToken";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Undo,
  Redo,
  X,
  ChevronDown,
  Type,
  Palette,
} from "lucide-react";
import { Button, Input } from "rizzui";
import { Dialog, Transition, Menu } from "@headlessui/react";
import { BulletList, OrderedList } from "./TipTapListExtensions";
import { GrammarChecker } from "./TipTapGrammarChecker";
import { FontSize } from "./TipTapFontSizeExtension";
import { Color } from "./TipTapColorExtension";

export interface FieldTokenEditorRef {
  insertPlaceholder: (placeholder: string) => void;
  focus: () => void;
}

interface TipTapFieldTokenEditorProps {
  value: string; // Text with placeholders like "Hello {{employee.name}} world"
  onChange: (newValue: string) => void;
  getFieldLabel: (fieldRef: string) => string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  label?: string;
  spellCheck?: boolean;
  grammarCheck?: boolean;
}

export const TipTapFieldTokenEditor = forwardRef<
  FieldTokenEditorRef,
  TipTapFieldTokenEditorProps
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
      spellCheck = true,
      grammarCheck = true,
    },
    ref
  ) => {
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [customFontSize, setCustomFontSize] = useState("");
    const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
    const fontSizeMenuOpenRef = useRef(false);
    const [customColor, setCustomColor] = useState("");
    const [colorMenuOpen, setColorMenuOpen] = useState(false);
    const colorMenuOpenRef = useRef(false);
    const isUpdatingFromProps = useRef(false);

    // Helper function to clean invalid font-size values from HTML
    const cleanInvalidFontSizes = (html: string): string => {
      if (!html) return html;

      // Remove font-size: inherit and other invalid values from the HTML
      return html.replace(
        /style="([^"]*font-size:\s*(?:inherit|initial|unset|revert|revert-layer|medium|small|large|x-small|x-large|xx-small|xx-large|smaller|larger)[^"]*)"([^>]*)>/gi,
        (match, styleContent, rest) => {
          // Remove font-size: inherit (or other invalid values) from style
          const cleanedStyle = styleContent
            .replace(
              /font-size:\s*(?:inherit|initial|unset|revert|revert-layer|medium|small|large|x-small|x-large|xx-small|xx-large|smaller|larger);?/gi,
              ""
            )
            .replace(/;\s*;/g, ";") // Remove double semicolons
            .replace(/^\s*;\s*|\s*;\s*$/g, ""); // Remove leading/trailing semicolons

          if (cleanedStyle.trim()) {
            return `style="${cleanedStyle}"${rest}>`;
          } else {
            // If style is empty after cleaning, remove the style attribute
            return rest ? rest + ">" : ">";
          }
        }
      );
    };

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          bulletList: false, // Disable default bullet list
          orderedList: false, // Disable default ordered list
          link: false, // Disable default link extension
          underline: false, // Disable default underline extension
        }),
        BulletList,
        OrderedList,
        Underline,
        FontSize,
        Color,
        Link.configure({ openOnClick: false, autolink: true }),
        Placeholder.configure({ placeholder: placeholder || "Start typing…" }),
        GrammarChecker.configure({ enabled: grammarCheck }),
        FieldToken,
      ],
      content: "", // Start empty, we'll set content in useEffect after editor is ready
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: `prose max-w-none p-3 outline-none ${multiline ? "min-h-[6rem]" : "min-h-[2.5rem]"}`,
          spellcheck: spellCheck && grammarCheck ? "true" : "false",
        },
      },
      onUpdate: ({ editor }) => {
        // Skip onChange if we're updating from props to prevent infinite loop
        if (isUpdatingFromProps.current) {
          return;
        }

        // Get HTML and clean up any invalid font-size values (like inherit)
        const html = editor.getHTML();
        const cleanedHtml = cleanInvalidFontSizes(html);

        onChange(cleanedHtml);
      },
    });

    // Update grammar checker and spellcheck when grammarCheck prop changes
    useEffect(() => {
      if (!editor) return;

      // Update spellcheck attribute
      const editorElement = editor.view.dom as HTMLElement;
      if (editorElement) {
        editorElement.setAttribute(
          "spellcheck",
          spellCheck && grammarCheck ? "true" : "false"
        );
      }

      // Update GrammarChecker extension options
      const grammarCheckerExtension = editor.extensionManager.extensions.find(
        (ext) => ext.name === "grammarChecker"
      );
      if (grammarCheckerExtension) {
        // Update the options
        (grammarCheckerExtension as any).options.enabled = grammarCheck;

        // Force plugin to re-apply by dispatching an empty transaction
        const { state } = editor.view;
        const tr = state.tr;
        editor.view.dispatch(tr);
      }
    }, [editor, grammarCheck, spellCheck]);

    // Helper function to update editor content with placeholders converted to tokens
    const updateEditorContent = useCallback(
      (
        editor: any,
        normalizedValue: string,
        getFieldLabel: (ref: string) => string
      ) => {
        // Clear editor first
        editor.commands.clearContent();

        // If empty, nothing to do
        if (!normalizedValue.trim()) return;

        // Parse the value and insert tokens/text using TipTap commands
        const placeholderRegex =
          /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
        let lastIndex = 0;
        let match;
        const matches: Array<{ index: number; placeholder: string }> = [];

        // Collect all matches first
        while ((match = placeholderRegex.exec(normalizedValue)) !== null) {
          matches.push({ index: match.index, placeholder: match[0] });
        }

        // Insert content in order
        matches.forEach(({ index, placeholder }) => {
          // Insert text before placeholder
          if (index > lastIndex) {
            const textBefore = normalizedValue.slice(lastIndex, index);
            if (textBefore) {
              editor.commands.insertContent(textBefore);
            }
          }

          // Insert field token
          const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
          const label = getFieldLabel(inner);
          editor.commands.insertFieldToken(placeholder, label);

          lastIndex = index + placeholder.length;
        });

        // Insert remaining text
        if (lastIndex < normalizedValue.length) {
          const textAfter = normalizedValue.slice(lastIndex);
          if (textAfter) {
            editor.commands.insertContent(textAfter);
          }
        }
      },
      [getFieldLabel]
    );

    // Update editor content when value prop changes
    useEffect(() => {
      if (!editor || value === undefined) return;

      // Get current editor HTML for comparison
      const currentHTML = editor.getHTML();
      const newValue = value || "";

      // Clean invalid font-size values from incoming value
      const cleanedValue = cleanInvalidFontSizes(newValue);

      // Compare HTML directly - if they're the same, no update needed
      if (currentHTML === cleanedValue) {
        return;
      }

      // Check if value contains HTML or is plain text
      const isHTML =
        newValue.includes("<") &&
        (newValue.includes("<p>") ||
          newValue.includes("<div>") ||
          newValue.includes("<strong>") ||
          newValue.includes("<em>") ||
          newValue.includes("<ul>") ||
          newValue.includes("<ol>"));

      // Check if value contains placeholders that need conversion
      const placeholderRegex = /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
      const hasPlaceholders = placeholderRegex.test(newValue);

      isUpdatingFromProps.current = true;

      if (isHTML) {
        // Value is HTML - check if it contains plain text placeholders that need conversion
        if (hasPlaceholders) {
          // Process HTML to convert plain text placeholders to field tokens
          const temp = document.createElement("div");
          temp.innerHTML = newValue;

          // Find all text nodes and convert placeholders to tokens
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

          // Replace placeholders with field token spans (in reverse order to maintain indices)
          textNodes.reverse().forEach(({ node, placeholder }) => {
            const parent = node.parentElement;
            if (!parent) return;

            const text = node.textContent || "";
            const index = text.indexOf(placeholder);
            if (index === -1) return;

            const before = text.substring(0, index);
            const after = text.substring(index + placeholder.length);

            // Create new nodes
            if (before) {
              parent.insertBefore(document.createTextNode(before), node);
            }

            // Create field token span
            const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
            const label = getFieldLabel(inner);
            const tokenSpan = document.createElement("span");
            tokenSpan.className =
              "field-token inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1";
            tokenSpan.setAttribute("data-placeholder", placeholder);
            tokenSpan.setAttribute("data-label", label);
            tokenSpan.setAttribute("contenteditable", "false");
            tokenSpan.innerHTML = `<span class="field-token-label">${label}</span>`;
            parent.insertBefore(tokenSpan, node);

            if (after) {
              parent.insertBefore(document.createTextNode(after), node);
            }

            parent.removeChild(node);
          });

          // Set the processed HTML (clean invalid font sizes)
          const processedHtml = cleanInvalidFontSizes(temp.innerHTML);
          editor.commands.setContent(processedHtml);
        } else {
          // Pure HTML without placeholders - set directly (clean invalid font sizes)
          editor.commands.setContent(cleanedValue);
        }
      } else if (hasPlaceholders) {
        // Value is plain text with placeholders - convert to tokens
        const normalizedValue = newValue.replace(/(\}\})(\{\{)/g, "$1 $2");
        updateEditorContent(editor, normalizedValue, getFieldLabel);
      } else {
        // Plain text without placeholders - set as HTML paragraph
        editor.commands.setContent(`<p>${cleanedValue}</p>`);
      }

      setTimeout(() => {
        isUpdatingFromProps.current = false;
      }, 0);
    }, [value, editor, getFieldLabel, updateEditorContent]);

    // Handle field token click (remove on click)
    useEffect(() => {
      if (!editor) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const token = target.closest(".field-token") as HTMLElement | null;
        if (token) {
          e.preventDefault();
          e.stopPropagation();
          const placeholder = token.getAttribute("data-placeholder");
          if (placeholder) {
            // Find the position of the token in the editor
            const { state } = editor;

            // Use TipTap to delete the node
            editor
              .chain()
              .focus()
              .command(({ tr, state }) => {
                const pos = editor.view.posAtDOM(token, 0);
                if (pos !== null) {
                  const resolvedPos = state.doc.resolve(pos);
                  if (resolvedPos.parent.type.name === "fieldToken") {
                    tr.delete(resolvedPos.before(), resolvedPos.after());
                  } else {
                    // If it's not a proper node, just delete the HTML element
                    token.remove();
                  }
                  return true;
                }
                return false;
              })
              .run();
          }
        }
      };

      const editorElement = editor.view.dom;
      editorElement.addEventListener("click", handleClick);

      return () => {
        editorElement.removeEventListener("click", handleClick);
      };
    }, [editor]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertPlaceholder: (placeholder: string) => {
        if (!editor) return;
        const inner = placeholder.replace(/^\{\{|\}\}$/g, "");
        const label = getFieldLabel(inner);
        editor.chain().focus().insertFieldToken(placeholder, label).run();
      },
      focus: () => {
        editor?.commands.focus();
      },
    }));

    if (!editor) return null;

    const ToolbarButton = ({
      onClick,
      active,
      disabled,
      label: btnLabel,
      children,
    }: any) => (
      <Button
        type="button"
        size="sm"
        variant={active ? "solid" : "outline"}
        onClick={onClick}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title={btnLabel}
      >
        {children}
      </Button>
    );

    return (
      <div className={`field-token-editor relative ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border border-gray-300 rounded-t-md bg-gray-50">
          <ToolbarButton
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo size={14} />
          </ToolbarButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <ToolbarButton
            label="H1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="H2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="H3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 size={14} />
          </ToolbarButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <ToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Strike"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough size={14} />
          </ToolbarButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Font Size Dropdown */}
          <Menu as="div" className="relative">
            {({ open }) => {
              // Update state when menu opens - defer to avoid setState during render
              if (open !== fontSizeMenuOpenRef.current) {
                setTimeout(() => {
                  fontSizeMenuOpenRef.current = open;
                  setFontSizeMenuOpen(open);

                  if (open && editor) {
                    // Get current font size from selection
                    const attrs = editor.getAttributes("fontSize");
                    if (attrs.fontSize) {
                      // Extract numeric value (e.g., "16px" -> "16")
                      const match =
                        attrs.fontSize.match(/^(\d+(?:\.\d+)?)px$/i);
                      if (match) {
                        setCustomFontSize(match[1]);
                      } else {
                        setCustomFontSize("");
                      }
                    } else {
                      setCustomFontSize("");
                    }
                  }
                }, 0);
              }

              const handleCustomFontSize = (value: string) => {
                // Remove any non-numeric characters except decimal point
                const numericValue = value.replace(/[^\d.]/g, "");
                setCustomFontSize(numericValue);
              };

              const applyCustomFontSize = () => {
                if (!customFontSize || isNaN(parseFloat(customFontSize))) {
                  return;
                }
                const fontSize = parseFloat(customFontSize);
                if (fontSize > 0 && fontSize <= 200) {
                  const fontSizeValue = `${fontSize}px`;
                  editor.chain().focus().setFontSize(fontSizeValue).run();
                }
              };

              return (
                <>
                  <Menu.Button as={Fragment}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      title="Font Size"
                    >
                      <Type size={14} />
                      <ChevronDown size={12} className="ml-1" />
                    </Button>
                  </Menu.Button>
                  <Menu.Items className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-96 overflow-auto">
                    <div className="py-1">
                      {[
                        { label: "8px", value: "8px" },
                        { label: "10px", value: "10px" },
                        { label: "12px", value: "12px" },
                        { label: "14px", value: "14px" },
                        { label: "16px", value: "16px" },
                        { label: "18px", value: "18px" },
                        { label: "20px", value: "20px" },
                        { label: "24px", value: "24px" },
                        { label: "28px", value: "28px" },
                        { label: "32px", value: "32px" },
                        { label: "36px", value: "36px" },
                        { label: "48px", value: "48px" },
                      ].map((size) => (
                        <Menu.Item key={size.value}>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                // Use chain to preserve focus and other marks
                                editor
                                  .chain()
                                  .focus()
                                  .setFontSize(size.value)
                                  .run();
                              }}
                              className={`${
                                active ? "bg-gray-100" : ""
                              } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                              style={{ fontSize: size.value }}
                            >
                              {size.label}
                            </button>
                          )}
                        </Menu.Item>
                      ))}
                      <div className="border-t border-gray-200 my-1" />
                      {/* Custom Font Size Input */}
                      <div className="px-3 py-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Custom Size (px)
                        </label>
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            value={customFontSize}
                            onChange={(e) =>
                              handleCustomFontSize(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyCustomFontSize();
                              }
                            }}
                            placeholder="e.g., 15"
                            className="h-8 text-sm"
                            inputClassName="text-sm"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={applyCustomFontSize}
                            disabled={
                              !customFontSize ||
                              isNaN(parseFloat(customFontSize)) ||
                              parseFloat(customFontSize) <= 0 ||
                              parseFloat(customFontSize) > 200
                            }
                            className="h-8 px-3 text-xs"
                          >
                            Apply
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Enter value 1-200
                        </p>
                      </div>
                      <div className="border-t border-gray-200 my-1" />
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            type="button"
                            onClick={() => {
                              editor.chain().focus().unsetFontSize().run();
                            }}
                            className={`${
                              active ? "bg-gray-100" : ""
                            } block w-full text-left px-4 py-2 text-sm text-gray-500`}
                          >
                            Reset Size
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </>
              );
            }}
          </Menu>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Text Color Dropdown */}
          <Menu as="div" className="relative">
            {({ open }) => {
              // Update state when menu opens - defer to avoid setState during render
              if (open !== colorMenuOpenRef.current) {
                setTimeout(() => {
                  colorMenuOpenRef.current = open;
                  setColorMenuOpen(open);

                  if (open && editor) {
                    // Get current color from selection
                    const attrs = editor.getAttributes("color");
                    if (attrs.color) {
                      setCustomColor(attrs.color);
                    } else {
                      setCustomColor("");
                    }
                  }
                }, 0);
              }

              const handleCustomColor = (value: string) => {
                setCustomColor(value);
              };

              const applyCustomColor = () => {
                if (!customColor || customColor.trim() === "") {
                  return;
                }
                // Validate hex color format
                const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
                const rgbPattern = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
                const rgbaPattern =
                  /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;

                const trimmedColor = customColor.trim();
                if (
                  hexPattern.test(trimmedColor) ||
                  rgbPattern.test(trimmedColor) ||
                  rgbaPattern.test(trimmedColor) ||
                  /^[a-z]+$/i.test(trimmedColor)
                ) {
                  // Named colors
                  editor.chain().focus().setColor(trimmedColor).run();
                }
              };

              // Predefined color palette
              const colorPalette = [
                { name: "Black", value: "#000000" },
                { name: "Dark Gray", value: "#333333" },
                { name: "Gray", value: "#666666" },
                { name: "Light Gray", value: "#999999" },
                { name: "White", value: "#FFFFFF" },
                { name: "Red", value: "#FF0000" },
                { name: "Orange", value: "#FF6600" },
                { name: "Yellow", value: "#FFCC00" },
                { name: "Green", value: "#00CC00" },
                { name: "Blue", value: "#0066FF" },
                { name: "Indigo", value: "#6600FF" },
                { name: "Violet", value: "#9900FF" },
                { name: "Pink", value: "#FF0099" },
                { name: "Brown", value: "#996633" },
                { name: "Dark Blue", value: "#003366" },
                { name: "Dark Green", value: "#006600" },
              ];

              return (
                <>
                  <Menu.Button as={Fragment}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      title="Text Color"
                    >
                      <Palette size={14} />
                      <ChevronDown size={12} className="ml-1" />
                    </Button>
                  </Menu.Button>
                  <Menu.Items className="absolute left-0 mt-1 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 max-h-96 overflow-auto">
                    <div className="py-1">
                      {/* Color Palette */}
                      <div className="px-3 py-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Color Palette
                        </label>
                        <div className="grid grid-cols-8 gap-1">
                          {colorPalette.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => {
                                editor
                                  .chain()
                                  .focus()
                                  .setColor(color.value)
                                  .run();
                              }}
                              className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-gray-200 my-1" />
                      {/* Custom Color Input */}
                      <div className="px-3 py-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Custom Color
                        </label>
                        <div className="flex gap-1">
                          <Input
                            type="text"
                            value={customColor}
                            onChange={(e) => handleCustomColor(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyCustomColor();
                              }
                            }}
                            placeholder="#000000 or rgb(0,0,0)"
                            className="h-8 text-sm flex-1"
                            inputClassName="text-sm"
                          />
                          <input
                            type="color"
                            value={
                              customColor && customColor.startsWith("#")
                                ? customColor
                                : "#000000"
                            }
                            onChange={(e) => {
                              setCustomColor(e.target.value);
                              editor
                                .chain()
                                .focus()
                                .setColor(e.target.value)
                                .run();
                            }}
                            className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                            title="Color Picker"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={applyCustomColor}
                            disabled={!customColor || customColor.trim() === ""}
                            className="h-8 px-3 text-xs"
                          >
                            Apply
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Enter hex (#000000) or rgb/rgba
                        </p>
                      </div>
                      <div className="border-t border-gray-200 my-1" />
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            type="button"
                            onClick={() => {
                              editor.chain().focus().unsetColor().run();
                            }}
                            className={`${
                              active ? "bg-gray-100" : ""
                            } block w-full text-left px-4 py-2 text-sm text-gray-500`}
                          >
                            Reset Color
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </>
              );
            }}
          </Menu>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Bullet List Dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button as={Fragment}>
              <Button
                type="button"
                size="sm"
                variant={editor.isActive("bulletList") ? "solid" : "outline"}
                className="h-7 px-2"
                title="Bullet List"
              >
                <List size={14} />
                <ChevronDown size={12} className="ml-1" />
              </Button>
            </Menu.Button>
            <Menu.Items className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleBulletList({ listStyleType: "disc" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      • Disc
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleBulletList({ listStyleType: "circle" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      ○ Circle
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleBulletList({ listStyleType: "square" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      ▪ Square
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Menu>

          {/* Ordered List Dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button as={Fragment}>
              <Button
                type="button"
                size="sm"
                variant={editor.isActive("orderedList") ? "solid" : "outline"}
                className="h-7 px-2"
                title="Numbered List"
              >
                <ListOrdered size={14} />
                <ChevronDown size={12} className="ml-1" />
              </Button>
            </Menu.Button>
            <Menu.Items className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleOrderedList({ listStyleType: "decimal" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      1. Decimal
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleOrderedList({ listStyleType: "lower-alpha" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      a. Lower Alpha
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleOrderedList({ listStyleType: "upper-alpha" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      A. Upper Alpha
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleOrderedList({ listStyleType: "lower-roman" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      i. Lower Roman
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .toggleOrderedList({ listStyleType: "upper-roman" })
                          .run();
                      }}
                      className={`${
                        active ? "bg-gray-100" : ""
                      } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                    >
                      I. Upper Roman
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Menu>
          <ToolbarButton
            label="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Code"
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code size={14} />
          </ToolbarButton>
          <ToolbarButton
            label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus size={14} />
          </ToolbarButton>
          <div className="w-px h-6 bg-gray-300 mx-1" />

          <ToolbarButton
            label="Link"
            active={editor.isActive("link")}
            onClick={() => {
              const prev = editor.getAttributes("link").href || "";
              setLinkUrl(prev);
              setLinkModalOpen(true);
            }}
          >
            <LinkIcon size={14} />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="border border-t-0 border-gray-300 rounded-b-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <EditorContent editor={editor} />
        </div>

        {/* Link Modal */}
        <Transition appear show={linkModalOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setLinkModalOpen(false)}
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
            </Transition.Child>
            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <Dialog.Title className="text-lg font-semibold">
                        Add Link
                      </Dialog.Title>
                      <button
                        onClick={() => setLinkModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <Input
                        label="URL"
                        placeholder="https://example.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (linkUrl.trim() === "") {
                              editor?.chain().focus().unsetLink().run();
                            } else {
                              editor
                                ?.chain()
                                .focus()
                                .extendMarkRange("link")
                                .setLink({ href: linkUrl.trim() })
                                .run();
                            }
                            setLinkModalOpen(false);
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setLinkModalOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (linkUrl.trim() === "") {
                              editor?.chain().focus().unsetLink().run();
                            } else {
                              editor
                                ?.chain()
                                .focus()
                                .extendMarkRange("link")
                                .setLink({ href: linkUrl.trim() })
                                .run();
                            }
                            setLinkModalOpen(false);
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    );
  }
);

TipTapFieldTokenEditor.displayName = "TipTapFieldTokenEditor";
