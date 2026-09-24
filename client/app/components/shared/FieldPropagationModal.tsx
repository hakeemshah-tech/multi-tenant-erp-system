"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Input } from "rizzui";
import { AlertTriangle, Check, GitBranch } from "lucide-react";
import {
  ApplyPropagationPayload,
  PropagationPreviewResponse,
} from "@/app/hooks/useFieldPropagation";
// import { prettyLabel } from "@/app/utils/profile-utils"; // small helper if you have; else inline

type BranchSelection = {
  branchId: string;
  checked: boolean;
  // which paths inside this branch (hits) should be updated
  paths: string[];
};

export default function FieldPropagationModal({
  open,
  onClose,
  fieldKey,
  fieldLabel,
  currentBranchId,
  currentValue,
  preview,
  loading,
  onPreview,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  fieldKey: string;
  fieldLabel?: string;
  currentBranchId: string;
  currentValue: any;
  preview: PropagationPreviewResponse | null;
  loading: boolean;
  onPreview: (args: {
    fieldKey: string;
    currentBranchId: string;
    currentValue: any;
  }) => void;
  onApply: (payload: ApplyPropagationPayload) => Promise<boolean>;
}) {
  const [updateMainProfile, setUpdateMainProfile] = useState(false);
  const [branchSelections, setBranchSelections] = useState<
    Record<string, BranchSelection>
  >({});

  // Load preview once when opening (or when input changes)
  useEffect(() => {
    if (!open) return;
    onPreview({ fieldKey, currentBranchId, currentValue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fieldKey, currentBranchId]);

  // Sync local selections with latest preview
  useEffect(() => {
    if (!preview) return;
    const next: Record<string, BranchSelection> = {};
    (preview.branches || []).forEach((b) => {
      // pre-check branches that differ by default
      const defaultChecked = !!b.differs;
      next[b.branchId] = {
        branchId: b.branchId,
        checked: defaultChecked,
        paths: (b.hits || []).map((h) => h.path),
      };
    });
    // main profile toggled only if preview says it differs or doesn’t exist
    setUpdateMainProfile(
      !!preview.mainProfile?.differs || !preview.mainProfile?.exists
    );
    setBranchSelections(next);
  }, [preview]);

  const submitDisabled = useMemo(() => {
    if (loading) return true;
    const anyBranch = Object.values(branchSelections).some((b) => b.checked);
    return !anyBranch && !updateMainProfile;
  }, [branchSelections, updateMainProfile, loading]);

  const handleToggleBranch = (branchId: string, checked: boolean) => {
    setBranchSelections((prev) => ({
      ...prev,
      [branchId]: {
        ...(prev[branchId] || { branchId, checked: false, paths: [] }),
        checked,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!preview) return;

    const payload: ApplyPropagationPayload = {
      fieldKey,
      currentBranchId,
      currentValue,
      updateMainProfile,
      selections: Object.values(branchSelections)
        .filter((s) => s.checked)
        .map((s) => ({
          branchId: s.branchId,
          paths: s.paths || [],
        })),
    };

    const ok = await onApply(payload);
    if (ok) onClose();
  };

  const title = fieldLabel || fieldKey;

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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl transition-all">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Keep “{title}” in sync across Organisations?
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-600">
                      You’re viewing this field in the current Oraganization.
                      You can push this value to other Organisations and/or the
                      main profile.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 text-xs font-semibold shadow-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Preview only, no changes yet</span>
                  </div>
                </div>

                {/* Current value card */}
                <div className="mb-6 rounded-xl border bg-gray-50 p-4">
                  <p className="text-xs uppercase font-semibold text-gray-500 mb-2">
                    Current Organisation value
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      value={
                        typeof currentValue === "object"
                          ? JSON.stringify(currentValue)
                          : String(currentValue ?? "")
                      }
                      readOnly
                    />
                    <div className="text-xs text-gray-500">
                      Field key: <span className="font-mono">{fieldKey}</span>
                    </div>
                  </div>
                </div>

                {/* Main profile toggle */}
                {preview && (
                  <div className="mb-6 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Update main profile with this value?
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {preview.mainProfile?.exists
                            ? preview.mainProfile?.differs
                              ? "This field exists in the main profile but differs."
                              : "This field already matches the main profile."
                            : "This field doesn’t exist in the main profile and can be created in additionalFields."}
                        </p>
                      </div>
                      <Checkbox
                        checked={updateMainProfile}
                        onChange={(e) => setUpdateMainProfile(e.target.checked)}
                        label="Update main profile"
                      />
                    </div>
                  </div>
                )}

                {/* Branch list */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-gray-800">
                    <GitBranch className="h-5 w-5" />
                    <p className="font-semibold">
                      Other Organisations with this field
                    </p>
                  </div>

                  {loading && (
                    <div className="rounded-lg border p-4 text-sm text-gray-600">
                      Loading preview…
                    </div>
                  )}

                  {!loading && preview?.branches?.length === 0 && (
                    <div className="rounded-lg border p-4 text-sm text-gray-600">
                      No other Organisations contain this field.
                    </div>
                  )}

                  {!loading &&
                    (preview?.branches || []).map((b) => {
                      const sel = branchSelections[b.branchId] || {
                        branchId: b.branchId,
                        checked: false,
                        paths: b.hits?.map((h) => h.path) || [],
                      };

                      const differsCount = b.hits?.filter((h) => h).length || 0;

                      return (
                        <div
                          key={b.branchId}
                          className="rounded-xl border bg-white p-4 hover:shadow-sm transition"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {b.branchName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {differsCount} location
                                {differsCount === 1 ? "" : "s"} for this field
                              </p>
                            </div>
                            <Checkbox
                              checked={sel.checked}
                              onChange={(e) =>
                                handleToggleBranch(b.branchId, e.target.checked)
                              }
                              label="Update this branch"
                            />
                          </div>

                          {/* paths list */}
                          <div className="mt-3 text-xs text-gray-600">
                            {(b.hits || []).map((h, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 py-1"
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                                <span className="font-mono">{h.path}</span>
                                <span className="text-gray-400">current:</span>
                                <span className="truncate">
                                  {typeof h.currentValue === "object"
                                    ? JSON.stringify(h.currentValue)
                                    : String(h.currentValue ?? "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitDisabled}>
                    Apply updates
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
