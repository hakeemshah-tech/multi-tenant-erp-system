import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, Checkbox } from "rizzui";

type OrgFieldPreview = {
  employeeId: string;
  tenantId: string;
  branchId: string;
  tenantName?: string;
  branchName?: string;
  fieldKey: string;
  occurrences?: number;
};

const toTitle = (s?: string) =>
  (s || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

function makeKey(it: OrgFieldPreview, idx: number) {
  return `${it.employeeId}:${it.fieldKey}:${idx}`;
}

export default function PropagationConsentModal({
  open,
  overlaps,
  onClose, // abort (don't save profile)
  onSkip, // continue save without updating org
  onConfirm, // apply to org for selected rows
  confirming,
}: {
  open: boolean;
  overlaps: OrgFieldPreview[];
  onClose: () => void;
  onSkip: () => void;
  onConfirm: (selected: OrgFieldPreview[]) => void;
  confirming: boolean;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    overlaps.forEach((item, idx) => {
      next[makeKey(item, idx)] = true;
    });
    setChecked(next);
  }, [open, overlaps]);

  // group by org (tenant + branch)
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { title: string; items: Array<OrgFieldPreview & { __idx: number }> }
    >();
    overlaps.forEach((it, idx) => {
      const groupKey = `${it.tenantId}:${it.branchId}`;
      const title = [it.tenantName || "Organization", it.branchName || "Branch"]
        .filter(Boolean)
        .join(" • ");
      const g = m.get(groupKey) || { title, items: [] };
      g.items.push({ ...it, __idx: idx });
      m.set(groupKey, g);
    });
    return Array.from(m.values());
  }, [overlaps]);

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    overlaps.forEach((it, idx) => (next[makeKey(it, idx)] = val));
    setChecked(next);
  };

  const toggleGroup = (
    items: Array<OrgFieldPreview & { __idx: number }>,
    val: boolean
  ) => {
    const next = { ...checked };
    items.forEach((it) => (next[makeKey(it, it.__idx)] = val));
    setChecked(next);
  };

  const selected = overlaps.filter((it, idx) => checked[makeKey(it, idx)]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" onClose={() => {}} className="relative z-[60]">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-2 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
                <div className="p-5 border-b flex items-center justify-between">
                  <Dialog.Title className="text-base font-semibold">
                    Share updates with your organisations?
                  </Dialog.Title>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAll(true)}
                    >
                      Select all
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAll(false)}
                    >
                      Deselect all
                    </Button>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-md hover:bg-gray-100"
                    >
                      <XMarkIcon className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-6">
                  {groups.map((g, gi) => (
                    <div
                      key={gi}
                      className="rounded-xl border border-gray-200 overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                        <div className="font-medium">{g.title}</div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleGroup(g.items, true)}
                          >
                            Select
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleGroup(g.items, false)}
                          >
                            Deselect
                          </Button>
                        </div>
                      </div>

                      <ul className="divide-y">
                        {g.items.map((it) => {
                          const key = makeKey(it, it.__idx);
                          return (
                            <li key={key} className="p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={!!checked[key]}
                                  onChange={(e) =>
                                    setChecked((prev) => ({
                                      ...prev,
                                      [key]: e.target.checked,
                                    }))
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm text-gray-500">
                                      Field
                                    </span>
                                    <span className="text-sm font-medium">
                                      {toTitle(it.fieldKey)}
                                    </span>
                                    {!!it.occurrences && it.occurrences > 1 ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                        {it.occurrences} places
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Selecting will update <b>all</b> “
                                    {toTitle(it.fieldKey)}” copies in this
                                    organisation.
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}

                  {groups.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No organisation fields will be changed.
                    </div>
                  )}
                </div>

                <div className="p-5 border-t flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={confirming}
                  >
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onSkip}
                    disabled={confirming}
                  >
                    Save without updating org
                  </Button>
                  <Button
                    onClick={() => onConfirm(selected)}
                    disabled={confirming || selected.length === 0}
                  >
                    Update org
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
