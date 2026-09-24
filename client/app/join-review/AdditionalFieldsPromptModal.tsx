"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox } from "rizzui";
import { CheckCircle2, Info, X } from "lucide-react";
import { previewValue } from "@/app/utils/profile-utils";

export type AdditionalCandidate = {
  id: string;
  sectionKey: string;
  innerSectionKey?: string | null;
  fieldKey: string;
  label: string;
  sectionLabel: string;
  innerSectionLabel?: string;
  path: string;
  value: any;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  candidates: AdditionalCandidate[];
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  loading?: boolean;
};

const AdditionalFieldsPromptModal: React.FC<Props> = React.memo(
  function AdditionalFieldsPromptModal({
    isOpen,
    onClose,
    candidates,
    onConfirm,
    loading,
  }) {
    const [selected, setSelected] = useState<Record<string, boolean>>({});

    useEffect(() => {
      if (isOpen) {
        setSelected({}); // default: nothing selected => isShowInProfile:false
      }
    }, [isOpen, candidates]);

    const allChecked = useMemo(
      () =>
        Object.keys(selected).length > 0 &&
        candidates.every((c) => selected[c.id]),
      [selected, candidates]
    );

    const toggleAll = () => {
      if (allChecked) {
        setSelected({});
      } else {
        const pre: Record<string, boolean> = {};
        candidates.forEach((c) => (pre[c.id] = true));
        setSelected(pre);
      }
    };

    const handleConfirm = () => {
      const ids = candidates.filter((c) => selected[c.id]).map((c) => c.id);
      onConfirm(ids);
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div className="relative w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/60">
            <div className="flex items-center gap-2 text-gray-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-semibold">Add to Main Profile</h3>
            </div>
            <button
              className="p-2 rounded hover:bg-gray-100"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Info className="w-4 h-4 mt-0.5 text-blue-600" />
              <p>
                We noticed you’ve filled some{" "}
                <span className="font-medium text-gray-800">
                  additional fields
                </span>
                . Do you want to show them on your
                <span className="font-medium text-gray-800"> Main Profile</span>
                ? Select the items to include.
              </p>
            </div>

            <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
              <div className="text-sm text-gray-700">
                {candidates.length} field{candidates.length > 1 ? "s" : ""}{" "}
                eligible
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  label="Select all"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </div>
            </div>

            <ul className="divide-y border rounded-lg">
              {candidates.map((c) => (
                <li key={c.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={!!selected[c.id]}
                      onChange={() =>
                        setSelected((s) => ({ ...s, [c.id]: !s[c.id] }))
                      }
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-gray-900">
                          {c.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {c.sectionLabel}
                          {c.innerSectionLabel
                            ? ` › ${c.innerSectionLabel}`
                            : ""}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="text-gray-500">Current:</span>{" "}
                        {previewValue(c.value)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50/60">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Not now
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || candidates.every((c) => !selected[c.id])}
            >
              {loading ? "Updating…" : "Add to Profile"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default AdditionalFieldsPromptModal;
