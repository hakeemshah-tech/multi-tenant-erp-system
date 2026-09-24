"use client";
import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import set from "lodash/set";
import toast from "react-hot-toast";
import { Input } from "rizzui";
import ReactDatePicker from "@/app/components/ui/DatePicker";
import axiosInstance from "@/app/lib/axios";

type Props = {
  field: any;
  fullPath: string;
  value: any;
  formik: any;
  autoSave: (values: any) => void;
};

const FileUploadField: React.FC<Props> = React.memo(function FileUploadField({
  field,
  fullPath,
  value,
  formik,
  autoSave,
}) {
  const fileMeta = field.fileMeta || {};

  // --- detect special handling for employee photo ---
  const isEmployeePhoto = useMemo(
    () => String(field?.key || "").toLowerCase() === "employeephoto",
    [field?.key]
  );

  // --- preview URL kept out of Formik so it's not submitted ---
  const initialStoredPreview = value?.url || value?.previewUrl || ""; // support legacy values if any
  const [previewUrl, setPreviewUrl] = useState<string>(initialStoredPreview);

  // keep preview in sync if formik value changes externally (e.g., draft load)
  useEffect(() => {
    const urlFromValue = value?.url || value?.previewUrl || "";
    if (urlFromValue && urlFromValue !== previewUrl) {
      setPreviewUrl(urlFromValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.url, value?.previewUrl]);

  const fileUrl = previewUrl || ""; // used only for displaying
  const isImage = (url: string) =>
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url.split("?")[0] || "");
  const isUploadedImage = !!fileUrl && isImage(fileUrl);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append("file", file);

        const { data } = await axiosInstance.post("/uploads", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        // uploader can return either at root or under data.data
        const payload = data?.data ?? data ?? {};
        const uploadedUrl = payload?.url;
        const uploadedId = payload?.id || payload?.fileId;
        const uploadedKey = payload?.key;

        if (isEmployeePhoto) {
          // For employeephoto: store ONLY { fileId, key } in Formik
          if (!uploadedId || !uploadedKey) {
            throw new Error("Upload did not return fileId/id and key.");
          }
          const updated = { ...formik.values };
          set(updated, fullPath, { fileId: uploadedId, key: uploadedKey });
          formik.setFieldValue(fullPath, {
            fileId: uploadedId,
            key: uploadedKey,
          });

          // keep signed URL for preview only (not in formik)
          if (uploadedUrl) setPreviewUrl(uploadedUrl);

          autoSave(updated);
        } else {
          // For all other file fields: store url as before
          if (!uploadedUrl) throw new Error("No file URL returned.");
          const updated = { ...formik.values };
          set(updated, `${fullPath}.url`, uploadedUrl);
          formik.setFieldValue(`${fullPath}.url`, uploadedUrl);
          setPreviewUrl(uploadedUrl); // keep UI consistent
          autoSave(updated);
        }

        toast.success("File uploaded");
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Upload failed");
      }
    },
    [fullPath, formik, autoSave, isEmployeePhoto]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    accept: { "application/pdf": [], "image/*": [] },
  });

  const metaNodes: JSX.Element[] = [];

  if (fileMeta.expiryDate) {
    metaNodes.push(
      <div key={`${fullPath}.expiryDate`} className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Expiry Date</label>
        <ReactDatePicker
          selected={value?.expiryDate ? new Date(value.expiryDate) : null}
          onChange={(val) => {
            formik.setFieldValue(
              `${fullPath}.expiryDate`,
              val?.toISOString() || null
            );
            autoSave(formik.values);
          }}
          dateFormat="dd/MM/yyyy"
        />
      </div>
    );
  }

  if (fileMeta.issuingDate) {
    metaNodes.push(
      <div key={`${fullPath}.issuingDate`} className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Issue Date</label>
        <ReactDatePicker
          selected={value?.issuingDate ? new Date(value.issuingDate) : null}
          onChange={(val) => {
            formik.setFieldValue(
              `${fullPath}.issuingDate`,
              val?.toISOString() || null
            );
            autoSave(formik.values);
          }}
          dateFormat="dd/MM/yyyy"
        />
      </div>
    );
  }

  if (fileMeta.referenceNumber) {
    metaNodes.push(
      <div key={`${fullPath}.referenceNumber`} className="space-y-1">
        <Input
          label="Reference Number"
          value={value?.referenceNumber || ""}
          onChange={(e) => {
            formik.setFieldValue(`${fullPath}.referenceNumber`, e.target.value);
            autoSave(formik.values);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-800">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {isUploadedImage ? (
        <div
          {...getRootProps()}
          onClick={open}
          className="relative cursor-pointer group"
        >
          <img
            src={fileUrl}
            alt="Uploaded"
            className="max-w-xs max-h-48 rounded border shadow group-hover:opacity-80 transition"
          />
          <div className="text-sm text-gray-500 mt-2">
            Click or drag another image to replace
          </div>
          <input {...getInputProps()} />
        </div>
      ) : (
        <>
          {fileUrl && (
            <div className="flex flex-col items-start gap-1 text-sm">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                View File (
                {decodeURIComponent(fileUrl.split("/").pop() || "file")})
              </a>
            </div>
          )}

          <div
            {...getRootProps()}
            onClick={open}
            className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-4 py-6 transition cursor-pointer ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-sm text-gray-600">
              {fileUrl ? (
                <>
                  <p className="text-green-700 font-medium mb-1">
                    File uploaded ✔
                  </p>
                  <p>Click or drag a new file to replace</p>
                </>
              ) : (
                <>
                  <p className="mb-1">No file uploaded</p>
                  <span>
                    Drag & drop a file here or{" "}
                    <span className="text-blue-600 underline cursor-pointer">
                      browse
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {metaNodes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metaNodes}
        </div>
      )}
    </div>
  );
});

export default FileUploadField;
