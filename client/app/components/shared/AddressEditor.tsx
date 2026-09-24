"use client";
import React from "react";
import { Button } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import { FieldControl } from "./FieldControl";
import { passesShowIf } from "@/app/utils/common";
import { FieldConfig, SectionConfig } from "@/app/types/employee-fields";
import { TrashIcon } from "@heroicons/react/24/solid";

export function AddressEditor({
  section,
  addressDraft,
  setAddressDraft,
  makeAddressRowLookup,
  referenceOptions,
}: {
  section: SectionConfig;
  addressDraft: any[];
  setAddressDraft: React.Dispatch<React.SetStateAction<any[]>>;
  makeAddressRowLookup: (idx: number) => (key: string) => any;
  referenceOptions?: Record<string, { label: string; value: string }[]>;
}) {
  return (
    <div className="space-y-6">
      {addressDraft.map((addr, index) => {
        const rowLookup = makeAddressRowLookup(index);
        const visibleFields = (section.fields || []).filter((f) =>
          passesShowIf(f, rowLookup)
        );
        return (
          <Card
            key={index}
            className="relative border border-gray-200 shadow-sm p-4"
          >
            <div className="absolute right-3 top-3">
              {addressDraft.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setAddressDraft((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleFields.map((f: FieldConfig) => (
                <div key={`address.${index}.${f.key}`}>
                  <FieldControl
                    field={f}
                    value={addr?.[f.key]}
                    onChange={(v) =>
                      setAddressDraft((prev) => {
                        const next = [...prev];
                        next[index] = { ...(next[index] || {}), [f.key]: v };
                        return next;
                      })
                    }
                    referenceOptions={referenceOptions}
                  />
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <Button
        variant="outline"
        onClick={() => setAddressDraft((prev) => [...prev, {}])}
      >
        + Add Address
      </Button>
    </div>
  );
}
