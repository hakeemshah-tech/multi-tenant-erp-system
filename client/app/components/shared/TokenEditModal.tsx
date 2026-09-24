"use client";

import React, { useState, useEffect, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { Button } from "rizzui";
import { TipTapRichTextEditor } from "./TipTapRichTextEditor";

interface TokenEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formattedHtml: string) => void;
  tokenLabel: string;
  tokenPlaceholder: string;
  initialContent: string; // HTML content of the token with formatting
}

export default function TokenEditModal({
  isOpen,
  onClose,
  onSave,
  tokenLabel,
  tokenPlaceholder,
  initialContent,
}: TokenEditModalProps) {
  const [content, setContent] = useState(initialContent);

  // Update content when initialContent changes (when modal opens with different token)
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = () => {
    onSave(content);
    onClose();
  };

  const handleCancel = () => {
    setContent(initialContent); // Reset to initial content
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Format Field Token
                  </Dialog.Title>
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Field Label:
                    </p>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {tokenLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Field Reference:
                    </p>
                    <code className="text-xs text-gray-600 bg-gray-100 px-3 py-2 rounded-md block">
                      {tokenPlaceholder}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Apply formatting (font size, color, headings, bold, italic,
                    etc.) to this field token. The formatting will be preserved
                    when the token is displayed in the contract.
                  </p>
                </div>

                <div className="mb-4 border border-gray-200 rounded-lg p-3 min-h-[250px] bg-gray-50">
                  <TipTapRichTextEditor
                    value={content}
                    onChange={setContent}
                    placeholder="Format this field token..."
                    multiline={false}
                    spellCheck={false}
                    grammarCheck={false}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Apply Formatting</Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
