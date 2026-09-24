"use client";

import { Fragment, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, Checkbox, Input } from "rizzui";
import { CheckCircle2, GitBranch, LayoutList, X } from "lucide-react";

export type DiscrepancyOccurrence = {
  sectionLabel: string; // e.g. "Personal Details"
  path: string; // e.g. "personaldetails.firstname"
  value: string | null; // branch value
};

export type BranchDiscrepancy = {
  branchId: string;
  branchName: string;
  occurrences: DiscrepancyOccurrence[]; // could appear in multiple sections/paths
};

export function FieldResolveModal({
  open,
  onClose,
  fieldLabel,
  currentBranchName,
  currentValue,
  canUpdateMainProfile = true,
  discrepancies = [], // branches where value differs
  onConfirm, // UI-only callback for now
}: {
  open: boolean;
  onClose: () => void;
  fieldLabel: string;
  currentBranchName: string;
  currentValue: string | null | undefined;
  canUpdateMainProfile?: boolean;
  discrepancies?: BranchDiscrepancy[];
  onConfirm: (payload: {
    updateMainProfile: boolean;
    branchesToUpdate: { branchId: string; selectedPaths: string[] }[];
  }) => void;
}) {
  const [updateMainProfile, setUpdateMainProfile] = useState<boolean>(false);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  // map: branchId -> Set<path>

  const hasDiscrepancies = discrepancies.length > 0;

  const togglePath = (branchId: string, path: string) => {
    setSelections((prev) => {
      const existing = prev[branchId]
        ? new Set(prev[branchId])
        : new Set<string>();
      if (existing.has(path)) existing.delete(path);
      else existing.add(path);
      return { ...prev, [branchId]: existing };
    });
  };

  const selectAllForBranch = (branchId: string, paths: string[]) => {
    setSelections((prev) => ({ ...prev, [branchId]: new Set(paths) }));
  };

  const clearAllForBranch = (branchId: string) => {
    setSelections((prev) => ({ ...prev, [branchId]: new Set() }));
  };

  const summary = useMemo(() => {
    const out: { branchId: string; selectedPaths: string[] }[] = [];
    for (const b of discrepancies) {
      const set = selections[b.branchId];
      if (set && set.size)
        out.push({ branchId: b.branchId, selectedPaths: Array.from(set) });
    }
    return out;
  }, [discrepancies, selections]);

  const handleConfirm = () => {
    onConfirm({ updateMainProfile, branchesToUpdate: summary });
    onClose();
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-1 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-1 scale-95"
            >
              <Dialog.Panel className="w-full transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Resolve “{fieldLabel}”
                  </Dialog.Title>
                  <button
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Main profile question */}
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">
                      Do you want to add or update this field in the main
                      profile?
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs uppercase text-gray-500">
                        Current Organisation
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {currentBranchName}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {currentValue ? String(currentValue) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <Checkbox
                        checked={!!updateMainProfile}
                        onChange={(e) => setUpdateMainProfile(e.target.checked)}
                        disabled={!canUpdateMainProfile}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Update main profile with this value
                        </p>
                        {!canUpdateMainProfile && (
                          <p className="text-xs text-gray-500">
                            Not allowed for this field
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch differences */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">
                    {hasDiscrepancies
                      ? "Other Organisations with different values"
                      : "No differences found in other Organisations"}
                  </h4>

                  {hasDiscrepancies ? (
                    <div className="space-y-4">
                      {discrepancies.map((b) => {
                        const allPaths = b.occurrences.map((o) => o.path);
                        const selected =
                          selections[b.branchId] || new Set<string>();
                        const allSelected =
                          selected.size === allPaths.length &&
                          allPaths.length > 0;

                        return (
                          <div
                            key={b.branchId}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4 text-indigo-600" />
                                <p className="text-sm font-semibold text-gray-900">
                                  {b.branchName}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() =>
                                    selectAllForBranch(b.branchId, allPaths)
                                  }
                                >
                                  Select all
                                </Button>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => clearAllForBranch(b.branchId)}
                                >
                                  Clear
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {b.occurrences.map((o, idx) => (
                                <label
                                  key={`${b.branchId}-${o.path}-${idx}`}
                                  className="flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3"
                                >
                                  <Checkbox
                                    checked={selected.has(o.path)}
                                    onChange={() =>
                                      togglePath(b.branchId, o.path)
                                    }
                                  />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <LayoutList className="h-4 w-4 text-gray-500" />
                                      <p className="text-sm font-medium text-gray-900">
                                        {o.sectionLabel}
                                      </p>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {o.path}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                      {o.value ? String(o.value) : "—"}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>

                            <div className="mt-3 text-right text-xs text-gray-600">
                              {selected.size} / {allPaths.length} selected
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
                      Nothing to resolve, values are consistent.
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirm}>Continue</Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
