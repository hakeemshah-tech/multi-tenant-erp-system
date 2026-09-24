"use client";

import { Dialog, Transition } from "@headlessui/react";
import React, { Fragment, useCallback, useEffect, useMemo } from "react";
import ReactDatePicker from "@/app/components/ui/DatePicker";
import { Button, Input, Select } from "rizzui";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import set from "lodash/set";
import get from "lodash/get";
import axiosInstance from "@/app/lib/axios";
import { FileTextIcon, ImageIcon } from "lucide-react";
import { cloneDeep } from "lodash";
import { COUNTRIES } from "@/app/utils/countries";

/* ---------------- utils: validity ---------------- */
type ValidityUnit = "Days" | "Months" | "Years";

function parseValidityPeriod(
  str?: string
): { amount: number; unit: ValidityUnit } | null {
  if (!str) return null;
  const m = String(str)
    .trim()
    .match(/^([\d.]+)\s*(Days|Months|Years)$/i);
  if (!m) return null;
  const amount = parseFloat(m[1]);
  const unit = (m[2][0].toUpperCase() +
    m[2].slice(1).toLowerCase()) as ValidityUnit;
  return { amount, unit };
}

function addValidity(startISO: string, amount: number, unit: ValidityUnit) {
  const base = new Date(startISO);
  if (Number.isNaN(base.getTime())) return startISO;
  const d = new Date(base.getTime());

  if (unit === "Days") {
    const whole = Math.trunc(amount);
    const frac = amount - whole;
    d.setDate(d.getDate() + whole);
    if (frac) d.setTime(d.getTime() + Math.round(frac * 24 * 60 * 60 * 1000));
  } else if (unit === "Months") {
    const whole = Math.trunc(amount);
    const frac = amount - whole;
    d.setMonth(d.getMonth() + whole);
    if (frac) d.setDate(d.getDate() + Math.round(frac * 30));
  } else {
    const whole = Math.trunc(amount);
    const frac = amount - whole;
    d.setFullYear(d.getFullYear() + whole);
    if (frac) d.setMonth(d.getMonth() + Math.round(frac * 12));
  }

  return d.toISOString();
}

function computeExpiryISO(issuingISO?: string, validity?: string) {
  const parsed = parseValidityPeriod(validity);
  if (!issuingISO || !parsed) return null;
  return addValidity(issuingISO, parsed.amount, parsed.unit);
}

/* ---------------- signed preview helper ---------------- */
function useSignedPreviewUrl(fileId?: string | null) {
  const [url, setUrl] = React.useState<string | null>(null);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (!fileId) {
      setUrl(null);
      return null;
    }

    const fileIdString = String(fileId);

    try {
      const { data } = await axiosInstance.get<{
        url: string;
        expiresIn: number;
      }>(`/uploads/${fileIdString}/url`);
      const fresh = data?.url || null;
      setUrl(fresh);
      return fresh;
    } catch (error) {
      console.error(
        "Failed to generate signed URL for fileId:",
        fileIdString,
        error
      );
      setUrl(null);
      return null;
    }
  }, [fileId]);

  useEffect(() => {
    setUrl(null);
    if (fileId) void refresh();
  }, [fileId, refresh]);

  return { url, refresh };
}

/* ---------------- component ---------------- */
export default function OrganizationDocumentUploadModal({
  isOpen,
  onClose,
  field,
  fullPath,
  formik,
  autoSave,
  employeeId,
  isEmployeeContext = false,
  canWrite = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  field: any;
  fullPath: string;
  formik: {
    values: any;
    setValues?: (v: any) => void;
    setFieldValue?: (path: string, value: any) => void;
  };
  autoSave: (
    values: any,
    updatedField?: { path: string; field: string; value: any; oldValue: any }
  ) => void;
  employeeId: string;
  isEmployeeContext?: boolean;
  canWrite?: boolean;
}) {
  const value = get(formik.values, fullPath);

  // Config gates (STRICT)
  const allowIssuing = field?.fileMeta?.issuingDate === true;
  const allowExpiry = field?.fileMeta?.expiryDate === true;
  const allowRef = field?.fileMeta?.referenceNumber === true;
  const allowCountryOfIssue = field?.fileMeta?.countryOfIssue === true;
  const validityStr: string | undefined = field?.fileMeta?.validityPeriod;
  const expiryLocked = Boolean(field?.fileMeta?.expiryIsDisabled);

  // Local state for draft values (not submitted until OK is clicked)
  const [draftFile, setDraftFile] = React.useState<{
    fileId?: string;
    key?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [draftIssuingDate, setDraftIssuingDate] = React.useState<string | null>(
    null
  );
  const [draftExpiryDate, setDraftExpiryDate] = React.useState<string | null>(
    null
  );
  const [draftReferenceNumber, setDraftReferenceNumber] =
    React.useState<string>("");
  const [draftCountryOfIssue, setDraftCountryOfIssue] =
    React.useState<string>("");
  const [validationErrors, setValidationErrors] = React.useState<{
    issuingDate?: string;
    expiryDate?: string;
    countryOfIssue?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize draft values from existing formik values when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftFile(
        value?.fileId && value?.key
          ? {
              fileId: value.fileId,
              key: value.key,
              fileName: value?.metadata?.originalFileName,
              fileSize: value?.metadata?.fileSize,
              mimeType: value?.metadata?.mimeType,
            }
          : null
      );
      setDraftIssuingDate(value?.issuingDate || null);
      setDraftExpiryDate(value?.expiryDate || null);
      setDraftReferenceNumber(value?.referenceNumber || "");
      setDraftCountryOfIssue(value?.countryOfIssue || "");
      setValidationErrors({});
    }
  }, [isOpen, value]);

  const hasFile = Boolean(draftFile?.fileId && draftFile?.key);

  // Signed preview URL (short-lived; never persisted)
  const isImage = useMemo(
    () =>
      draftFile?.key
        ? /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(draftFile.key)
        : false,
    [draftFile?.key]
  );
  const { url: previewUrl, refresh: refreshPreview } = useSignedPreviewUrl(
    draftFile?.fileId
  );

  // ---- helpers: safe set ----
  const setValuesSafe = (nextValues: any, changedPaths?: string[]) => {
    if (typeof formik?.setValues === "function") {
      formik.setValues(nextValues);
      return;
    }
    if (typeof formik?.setFieldValue === "function") {
      (changedPaths || []).forEach((p) => {
        formik.setFieldValue!(p, get(nextValues, p));
      });
      if (!changedPaths || changedPaths.length === 0) {
        formik.setFieldValue!(fullPath, get(nextValues, fullPath));
      }
    }
  };

  /* ---------- upload ---------- */
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles?.[0];
    if (!file) return;

    try {
      // Extract document type from field label or key
      const documentType = field?.label || field?.key || "document";

      // Upload the file to get tempFileId and tempKey
      const formData = new FormData();
      formData.append("file", file);

      // Build query params for custom file naming
      // Pass employeeId instead of employeeFirstName - backend will fetch it
      const queryParams = new URLSearchParams();
      if (employeeId) {
        queryParams.append("employeeId", employeeId);
      }
      if (documentType) {
        queryParams.append("documentType", documentType);
      }

      const uploadUrl = `/uploads${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

      const { data } = await axiosInstance.post(uploadUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const tempFileId: string | undefined = data?.id ?? data?.data?.id;
      const tempKey: string | undefined = data?.key ?? data?.data?.key;
      if (!tempFileId || !tempKey) throw new Error("Invalid upload response");

      // Store in local state (not submitted yet)
      setDraftFile({
        fileId: tempFileId,
        key: tempKey,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      toast.success("File selected. Click OK to submit.");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed");
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: {
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [],
      "image/*": [],
    },
  });

  /* ---------- unified preview opener (popup-safe + fresh URL) ---------- */
  const openPreview = useCallback(async () => {
    if (!draftFile?.fileId) return;
    const w = window.open("", "_blank");
    try {
      const fresh = await refreshPreview();
      if (fresh && w) {
        w.location.href = fresh;
      } else {
        w?.close();
        toast.error("Could not create preview link.");
      }
    } catch {
      w?.close();
      toast.error("Could not create preview link.");
    }
  }, [draftFile?.fileId, refreshPreview]);

  const renderPreview = () => {
    if (!hasFile) return null;

    const filename =
      draftFile?.fileName || draftFile?.key?.split("/").pop() || "File";

    if (isImage) {
      return (
        <div className="space-y-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Document"
              className="max-h-60 w-full object-contain border rounded-md"
              onError={() => void refreshPreview()}
            />
          ) : (
            <div className="border rounded-md p-3 bg-gray-50 text-sm text-gray-600">
              Image preview not ready.{" "}
              <button
                className="underline"
                type="button"
                onClick={() => void openPreview()}
              >
                Open in new tab
              </button>{" "}
              or{" "}
              <button
                className="underline"
                type="button"
                onClick={() => void refreshPreview()}
              >
                refresh preview
              </button>
              .
            </div>
          )}
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void openPreview()}
            >
              Open
            </Button>
          </div>
        </div>
      );
    }

    // Non-image: show filename + Preview button
    return (
      <div className="flex items-center gap-3 border rounded-md p-3 bg-gray-50">
        <FileTextIcon className="w-6 h-6 text-gray-500" />
        <span className="text-sm text-gray-700 truncate flex-1">
          {filename}
        </span>
        <Button size="sm" variant="outline" onClick={() => void openPreview()}>
          Preview
        </Button>
      </div>
    );
  };

  /* ---------- draft field updates ---------- */
  const handleIssuingChange = (date: Date | null) => {
    if (!allowIssuing) return;

    const iso = date ? date.toISOString() : null;
    setDraftIssuingDate(iso);

    // Clear validation error
    setValidationErrors((prev) => ({ ...prev, issuingDate: undefined }));

    // Auto-calc expiry if allowed and validity period is present
    if (allowExpiry && iso && validityStr) {
      const exp = computeExpiryISO(iso, validityStr);
      if (exp) setDraftExpiryDate(exp);
    }
  };

  const handleExpiryChange = (date: Date | null) => {
    if (!allowExpiry || expiryLocked) return;

    const iso = date ? date.toISOString() : null;
    setDraftExpiryDate(iso);

    // Clear validation error
    setValidationErrors((prev) => ({ ...prev, expiryDate: undefined }));
  };

  /* ---------- validate and submit ---------- */
  const handleSubmit = async () => {
    // Validate required fields
    const errors: {
      issuingDate?: string;
      expiryDate?: string;
      countryOfIssue?: string;
    } = {};

    if (allowIssuing && !draftIssuingDate) {
      errors.issuingDate = "Issue Date is required";
    }

    if (allowExpiry && !draftExpiryDate) {
      errors.expiryDate = "Expiry Date is required";
    }

    if (allowCountryOfIssue && !draftCountryOfIssue.trim()) {
      errors.countryOfIssue = "Country of Issue is required";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    if (!hasFile || !draftFile?.fileId || !draftFile?.key) {
      toast.error("Please upload a file");
      return;
    }

    setIsSubmitting(true);

    try {
      const pathParts = fullPath.split(".");
      const sectionKey = pathParts[0]; // "documents"
      const innerSectionKey = pathParts[1]; // "certificates"
      const fieldKey = pathParts[2]; // "cpr"

      // Use different logic based on context
      if (isEmployeeContext) {
        // Employee context: use createPendingDocument for pending approval
        const { createPendingDocument } =
          await import("@/app/services/pendingDocument.service");
        await createPendingDocument({
          employeeId,
          sectionKey,
          innerSectionKey,
          fieldKey,
          fileId: draftFile.fileId,
          key: draftFile.key,
          expiryDate: allowExpiry ? (draftExpiryDate ?? undefined) : undefined,
          issuingDate: allowIssuing
            ? (draftIssuingDate ?? undefined)
            : undefined,
          referenceNumber: allowRef
            ? draftReferenceNumber.trim() || undefined
            : undefined,
          countryOfIssue: allowCountryOfIssue
            ? draftCountryOfIssue.trim() || undefined
            : undefined,
          metadata: {
            originalFileName: draftFile.fileName || "document.pdf",
            fileSize: draftFile.fileSize || 0,
            mimeType: draftFile.mimeType || "application/pdf",
          },
        });

        // Update local state to show pending status
        const updated = cloneDeep(formik.values);
        set(updated, `${fullPath}.fileId`, draftFile.fileId);
        set(updated, `${fullPath}.key`, draftFile.key);
        set(updated, `${fullPath}.status`, "pendingToApprove");
        set(
          updated,
          `${fullPath}.metadata.uploadDate`,
          new Date().toISOString()
        );
        set(
          updated,
          `${fullPath}.metadata.originalFileName`,
          draftFile.fileName
        );
        set(updated, `${fullPath}.metadata.fileSize`, draftFile.fileSize);
        set(updated, `${fullPath}.metadata.mimeType`, draftFile.mimeType);
        if (allowIssuing)
          set(updated, `${fullPath}.issuingDate`, draftIssuingDate);
        if (allowExpiry)
          set(updated, `${fullPath}.expiryDate`, draftExpiryDate);
        if (allowRef)
          set(updated, `${fullPath}.referenceNumber`, draftReferenceNumber);

        setValuesSafe(updated);

        toast.success(`${fieldKey} document uploaded and sent for approval`);
      } else {
        // Employer context: use direct document management API which will auto-approve
        await axiosInstance.post("/documents/upload", {
          employeeId,
          sectionKey,
          innerSectionKey,
          fieldKey,
          fileId: draftFile.fileId,
          key: draftFile.key,
          expiryDate: allowExpiry ? (draftExpiryDate ?? undefined) : undefined,
          issuingDate: allowIssuing
            ? (draftIssuingDate ?? undefined)
            : undefined,
          referenceNumber: allowRef
            ? draftReferenceNumber.trim() || undefined
            : undefined,
          countryOfIssue: allowCountryOfIssue
            ? draftCountryOfIssue.trim() || undefined
            : undefined,
          metadata: {
            originalFileName: draftFile.fileName || "document.pdf",
            fileSize: draftFile.fileSize || 0,
            mimeType: draftFile.mimeType || "application/pdf",
          },
        });

        // Update local state to show approved status
        const updated = cloneDeep(formik.values);
        set(updated, `${fullPath}.fileId`, draftFile.fileId);
        set(updated, `${fullPath}.key`, draftFile.key);
        set(updated, `${fullPath}.status`, "approved");
        set(
          updated,
          `${fullPath}.metadata.uploadDate`,
          new Date().toISOString()
        );
        set(
          updated,
          `${fullPath}.metadata.originalFileName`,
          draftFile.fileName
        );
        set(updated, `${fullPath}.metadata.fileSize`, draftFile.fileSize);
        set(updated, `${fullPath}.metadata.mimeType`, draftFile.mimeType);
        if (allowIssuing)
          set(updated, `${fullPath}.issuingDate`, draftIssuingDate);
        if (allowExpiry)
          set(updated, `${fullPath}.expiryDate`, draftExpiryDate);
        if (allowRef)
          set(updated, `${fullPath}.referenceNumber`, draftReferenceNumber);
        if (allowCountryOfIssue)
          set(updated, `${fullPath}.countryOfIssue`, draftCountryOfIssue);

        setValuesSafe(updated);

        toast.success(`${fieldKey} document uploaded and approved`);
      }

      onClose();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    // Check if Select dropdown menu is open in the DOM
    const selectMenu = document.querySelector('[role="listbox"]');
    const selectOptions = document.querySelector('[role="option"]');

    // Don't close if Select dropdown is open
    if (selectMenu || selectOptions) {
      return;
    }
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleDialogClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl transition-all">
                {/* Header */}
                <div className="mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Upload Document: {field.label}
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-gray-600">
                    Select file and fill in required information, then click OK
                    to submit.
                  </p>
                </div>

                {/* Preview */}
                {hasFile && <div className="mb-6">{renderPreview()}</div>}

                {/* Upload Area */}
                <div
                  {...getRootProps()}
                  onClick={open}
                  className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-6 py-8 transition cursor-pointer ${
                    isDragActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <input {...getInputProps()} />
                  <ImageIcon className="w-6 h-6 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {hasFile
                      ? "Replace uploaded file"
                      : "Drag & drop or click to upload"}
                  </p>
                </div>

                {/* Meta Fields */}
                <div className="mt-6 space-y-4">
                  {allowIssuing && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Issue Date <span className="text-red-500">*</span>
                      </label>
                      <ReactDatePicker
                        selected={
                          draftIssuingDate ? new Date(draftIssuingDate) : null
                        }
                        onChange={handleIssuingChange}
                        dateFormat="dd/MM/yyyy"
                        inputProps={{ placeholder: "DD/MM/YYYY" }}
                      />
                      {validationErrors.issuingDate && (
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.issuingDate}
                        </p>
                      )}
                    </div>
                  )}

                  {allowExpiry && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Expiry Date{" "}
                        {!expiryLocked && (
                          <span className="text-red-500">*</span>
                        )}
                        {expiryLocked && (
                          <span className="ml-1 text-xs text-gray-500">
                            (auto-calculated)
                          </span>
                        )}
                      </label>
                      {/* Validity Period Hint */}
                      {validityStr && (
                        <p className="text-xs text-gray-600 mb-2 italic">
                          Employer has set Validity Period as &apos;
                          {validityStr} from issue date&apos;
                        </p>
                      )}
                      <div
                        className={
                          expiryLocked ? "pointer-events-none opacity-80" : ""
                        }
                      >
                        <ReactDatePicker
                          selected={
                            draftExpiryDate ? new Date(draftExpiryDate) : null
                          }
                          onChange={handleExpiryChange}
                          disabled={expiryLocked}
                          dateFormat="dd/MM/yyyy"
                          inputProps={{ placeholder: "DD/MM/YYYY" }}
                        />
                      </div>
                      {/* Locked Expiry Date Hint */}
                      {expiryLocked && (
                        <p className="mt-1 text-xs text-gray-600 italic">
                          The expiry date is locked by employer. You cannot
                          manually change it.
                        </p>
                      )}
                      {validationErrors.expiryDate && (
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.expiryDate}
                        </p>
                      )}
                    </div>
                  )}

                  {allowRef && (
                    <div>
                      <Input
                        label="Reference Number"
                        value={draftReferenceNumber}
                        onChange={(e) =>
                          setDraftReferenceNumber(e.target.value)
                        }
                      />
                    </div>
                  )}

                  {allowCountryOfIssue && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Country of Issue <span className="text-red-500">*</span>
                      </label>
                      <Select
                        label=""
                        value={
                          draftCountryOfIssue
                            ? {
                                label: draftCountryOfIssue,
                                value: draftCountryOfIssue,
                              }
                            : null
                        }
                        onChange={(opt) => {
                          setDraftCountryOfIssue(opt?.value || "");
                        }}
                        options={COUNTRIES}
                        placeholder="Search and select country"
                        isSearchable
                      />
                      {validationErrors.countryOfIssue && (
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.countryOfIssue}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  {canWrite && (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      isLoading={isSubmitting}
                    >
                      Submit Changes
                    </Button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
