"use client";
import React from "react";
import { FieldConfig, SectionConfig } from "@/app/types/employee-fields";
import { formatDatePretty, isNonEmpty } from "@/app/utils/common";

export type ReferenceOptionsMap = Record<
  string,
  { label: string; value: string }[]
>;

export function FieldValue({
  section,
  field,
  value,
  referenceOptions = {},
}: {
  section: SectionConfig;
  field: FieldConfig;
  value: any;
  referenceOptions?: ReferenceOptionsMap;
}) {
  if (!isNonEmpty(value)) return <span className="text-gray-400">—</span>;

  if (field.type === "file") {
    const url = typeof value === "string" ? value : (value as any)?.url;
    return (
      <a href={url} target="_blank" className="text-primary underline text-sm">
        View Document
      </a>
    );
  }
  if (field.type === "date") {
    return (
      <span className="text-sm font-medium text-gray-900">
        {formatDatePretty(value)}
      </span>
    );
  }
  if (field.type === "checkbox") {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
        {value ? "Yes" : "No"}
      </span>
    );
  }
  // Special formatting for hourly rate field
  if (field.key === "hourlyrate" && field.type === "number") {
    const numValue =
      typeof value === "string" ? parseFloat(value) : Number(value);
    if (isNaN(numValue)) return <span className="text-gray-400">—</span>;
    return (
      <span className="text-sm font-medium text-gray-900">
        ${numValue.toFixed(2)}
      </span>
    );
  }
  if (field.type === "reference") {
    const model = field.referenceModel || "";
    const opts = referenceOptions[model] || [];

    // Handle object values (populated references)
    if (typeof value === "object" && value !== null) {
      // Try to get title/name from the object itself first
      const title =
        (value as any)?.title || (value as any)?.name || (value as any)?.label;
      if (title) {
        return (
          <span className="text-sm font-medium text-gray-900">{title}</span>
        );
      }

      // Handle MongoDB ObjectId buffer format (when _id is an object with buffer property)
      let objId: string | null = null;
      if ((value as any)?._id) {
        if (typeof (value as any)._id === "string") {
          objId = (value as any)._id;
        } else if (
          (value as any)._id?.buffer &&
          typeof (value as any)._id.buffer === "object"
        ) {
          // Convert buffer to string (MongoDB ObjectId buffer format)
          const buffer = (value as any)._id.buffer;
          const hex = Array.from(buffer as any)
            .map((b: any) => b.toString(16).padStart(2, "0"))
            .join("");
          objId = hex;
        } else if ((value as any)._id?.toString) {
          objId = String((value as any)._id.toString());
        } else {
          objId = String((value as any)._id);
        }
      } else if ((value as any)?.id) {
        objId = String((value as any).id);
      }

      if (objId) {
        const match = opts.find((o) => String(o.value) === String(objId));
        if (match?.label) {
          return (
            <span className="text-sm font-medium text-gray-900">
              {match.label}
            </span>
          );
        }
        // Fallback to ID if nothing else works
        return (
          <span className="text-sm font-medium text-gray-900">
            {String(objId)}
          </span>
        );
      }

      // Fallback if no ID found
      return <span className="text-sm font-medium text-gray-400">—</span>;
    }

    // Handle string/ID values
    if (typeof value === "string" || typeof value === "number") {
      const match = opts.find((o) => String(o.value) === String(value));
      if (match?.label) {
        return (
          <span className="text-sm font-medium text-gray-900">
            {match.label}
          </span>
        );
      }
      // If no match found but options are still loading, show loading state
      if (model && !(model in (referenceOptions || {}))) {
        return (
          <span className="text-sm font-medium text-gray-400">Loading...</span>
        );
      }
      // Fallback: show ID (but this shouldn't happen if referenceOptions are loaded)
      return (
        <span className="text-sm font-medium text-gray-400">
          {String(value)}
        </span>
      );
    }

    return <span className="text-sm font-medium text-gray-400">—</span>;
  }
  return (
    <span className="text-sm font-medium text-gray-900">
      {typeof value === "string" ? value : JSON.stringify(value)}
    </span>
  );
}
