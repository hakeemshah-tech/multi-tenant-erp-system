"use client";
import React from "react";
import { Input, Select, Textarea, Checkbox } from "rizzui";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { FieldConfig } from "../types/employee-fields";
import { PhoneInput } from "./PhoneInput";

export function FieldControl({
  field,
  value,
  onChange,
  referenceOptions = {},
}: {
  field: FieldConfig;
  value: any;
  onChange: (v: any) => void;
  referenceOptions?: Record<string, { label: string; value: string }[]>;
}) {
  const labelText = field.required ? `${field.label} *` : field.label;

  if (["text", "email", "number"].includes(field.type)) {
    // Check if this is a mobile/phone field
    if (field.key === "mobile" || field.key === "phone") {
      return (
        <PhoneInput
          label={labelText}
          value={value ?? ""}
          onChange={(val) => onChange(val || "")}
          defaultCountry="AU"
          placeholder={field.placeholder || "Enter phone number"}
        />
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : (field.type as any)}
        label={labelText}
        value={value ?? ""}
        onChange={(e: any) => onChange(e.target.value)}
        autoComplete="off"
      />
    );
  }
  if (field.type === "phone" || field.type === "tel") {
    return (
      <PhoneInput
        label={labelText}
        value={value ?? ""}
        onChange={(val) => onChange(val || "")}
        defaultCountry="AU"
        placeholder={field.placeholder || "Enter phone number"}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        label={labelText}
        value={value ?? ""}
        onChange={(e: any) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "checkbox") {
    return (
      <div className="pt-6">
        <Checkbox
          label={labelText}
          checked={!!value}
          onChange={(e: any) => onChange(e.target.checked)}
        />
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <Input
        type="date"
        label={labelText}
        value={value ? String(value).slice(0, 10) : ""}
        onChange={(e: any) => onChange(e.target.value || "")}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select
        label={labelText}
        value={value ? { label: String(value), value: String(value) } : null}
        onChange={(opt: any) => onChange(opt?.value || "")}
        options={(field.options || []).map((o) => ({ label: o, value: o }))}
      />
    );
  }
  if (field.type === "reference") {
    const model = field.referenceModel || "";
    const opts = referenceOptions[model] || [];
    const currentId =
      typeof value === "object" && value
        ? (value as any)._id || (value as any).id || ""
        : value || "";
    const current =
      opts.find((o) => String(o.value) === String(currentId)) || null;

    return (
      <Select
        label={labelText}
        value={current}
        onChange={(opt: any) => onChange(opt?.value || "")}
        options={opts}
        isSearchable
      />
    );
  }
  if (field.type === "file") {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {labelText}
        </label>
        {value ? (
          <a
            className="inline-block text-blue-600 underline text-sm"
            target="_blank"
            href={typeof value === "string" ? value : (value as any)?.url}
          >
            View current file
          </a>
        ) : (
          <p className="text-xs text-gray-400">No file uploaded</p>
        )}
        <input
          type="file"
          onChange={async (e: any) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const formData = new FormData();
              formData.append("file", f);
              const { data } = await axiosInstance.post("/uploads", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              const url = (data?.url || data?.data?.url) as string | undefined;
              onChange(url ? { url } : url);
              toast.success("File uploaded");
            } catch {
              toast.error("Upload failed");
            }
          }}
        />
      </div>
    );
  }
  return null;
}
