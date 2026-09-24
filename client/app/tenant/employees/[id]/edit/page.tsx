"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Input, Select, Button, Textarea, Checkbox, Tab } from "rizzui";
import { useFormik } from "formik";
import axiosInstance from "@/app/lib/axios";
import ReactDatePicker from "@/app/components/ui/DatePicker";
import { Card } from "@/app/components/ui/Card";
import set from "lodash/set";
import get from "lodash/get";
import toast from "react-hot-toast";
import { useDropzone } from "react-dropzone";

export default function EmployeeProfileForm() {
  const params = useParams();
  const employeeId = params?.id as string;

  const [sections, setSections] = useState<any[]>([]);
  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  const [selectedDocuments, setSelectedDocuments] = useState<
    Record<string, string>
  >({});

  const autoSave = async (values: any) => {
    console.log(values, "just showw");
    setSaveStatus("saving");
    const cleanedValues = deepCleanFileFields(values);
    console.log(cleanedValues, "show it cleaned");

    const { profileUpdates, additionalFields } =
      splitProfileAndAdditionalFields(cleanedValues, sections);

    console.log(profileUpdates, "show after");

    if (Object.keys(profileUpdates).length > 0) {
      await axiosInstance.put(
        `/employee-profiles/${profileId}`,
        profileUpdates
      );
      setSaveStatus("success");
    }

    if (additionalFields.length > 0) {
      await axiosInstance.put(`/employees/${employeeId}`, {
        additionalFields,
      });
      setSaveStatus("success");
    }
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validate: (values) => {
      const errors: any = {};

      for (const section of sections) {
        // Top-level fields
        if (section.fields?.length) {
          for (const field of section.fields) {
            const path = `${section.sectionKey}.${field.key}`;
            const val = get(values, path);
            if (field.required) {
              if (field.type === "checkbox") {
                if (!val) set(errors, path, "This field is required.");
              } else if (field.type === "file") {
                if (!val?.url) set(errors, path, "Please upload a file.");
              } else if (field.type === "date") {
                if (!val) set(errors, path, "Please select a date.");
              } else if (field.type === "select") {
                if (!val) set(errors, path, "Please select an option.");
              } else if (!val || val === "") {
                set(errors, path, "This field is required.");
              }
            }
          }
        }

        // Inner sections
        if (section.innerSections?.length) {
          for (const inner of section.innerSections) {
            const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
            const groupValues = get(values, groupPath);

            if (inner.requirementMode === "OR") {
              // Check if at least one file has url
              const anyFilled = inner.fields.some((f) => {
                const v = get(values, `${groupPath}.${f.key}`);
                return v?.url;
              });
              if (!anyFilled) {
                inner.fields.forEach((f) => {
                  set(
                    errors,
                    `${groupPath}.${f.key}`,
                    "At least one document is required."
                  );
                });
              }
            }

            for (const field of inner.fields) {
              const path = `${groupPath}.${field.key}`;
              const val = get(values, path);
              if (inner.requirementMode !== "OR" && field.required) {
                if (field.type === "checkbox") {
                  if (!val) set(errors, path, "This field is required.");
                } else if (field.type === "file") {
                  if (!val?.url) set(errors, path, "Please upload a file.");
                } else if (field.type === "date") {
                  if (!val) set(errors, path, "Please select a date.");
                } else if (field.type === "select") {
                  if (!val) set(errors, path, "Please select an option.");
                } else if (!val || val === "") {
                  set(errors, path, "This field is required.");
                }
              }
            }
          }
        }
      }

      return errors;
    },
    onSubmit: async () => {},
  });

  const [draggingField, setDraggingField] = useState<string | null>(null);

  const fetchReferenceData = async (model: string) => {
    try {
      const res = await axiosInstance.get(`/${model.toLowerCase()}s`);
      const data = res.data?.data || [];

      const options = data.map((item: any) => ({
        label:
          model === "Employee"
            ? item?.employeeProfile?.personaldetails?.firstname || "Unnamed"
            : item?.name || "Unnamed",
        value: item._id,
      }));

      setReferenceOptions((prev) => ({
        ...prev,
        [model]: options,
      }));
    } catch (err) {
      console.error(`Failed to fetch ${model} data`, err);
    }
  };

  useEffect(() => {
    const loadReferenceOptions = async () => {
      const allModels = new Set<string>();

      for (const section of sections) {
        for (const field of section.fields || []) {
          if (field.type === "reference") allModels.add(field.referenceModel);
        }
        for (const inner of section.innerSections || []) {
          for (const field of inner.fields || []) {
            if (field.type === "reference") allModels.add(field.referenceModel);
          }
        }
      }

      await Promise.all(Array.from(allModels).map(fetchReferenceData));
    };

    if (sections.length) loadReferenceOptions();
  }, [sections]);

  function splitProfileAndAdditionalFields(
    values: any,
    sections: any[]
  ): {
    profileUpdates: any;
    additionalFields: any[];
  } {
    const profileUpdates: any = {};
    const additionalFields: any[] = [];

    for (const section of sections) {
      const sectionGroup = values[section.sectionKey];
      if (!sectionGroup) continue;

      // Special handling for address
      if (section.sectionKey === "address") {
        profileUpdates["address"] = values["address"];
        continue;
      }

      // Top-level fields
      for (const field of section.fields || []) {
        const val = sectionGroup[field.key];

        if (field.isAdditional) {
          additionalFields.push({
            sectionKey: section.sectionKey,
            innerSectionKey: null,
            fieldKey: field.key,
            value: val,
          });
        } else {
          if (!profileUpdates[section.sectionKey])
            profileUpdates[section.sectionKey] = {};
          profileUpdates[section.sectionKey][field.key] = val;
        }
      }

      // Inner sections
      for (const inner of section.innerSections || []) {
        const innerGroup = sectionGroup?.[inner.sectionKey];
        if (!innerGroup) continue;

        for (const field of inner.fields || []) {
          const val = innerGroup[field.key];

          if (field.isAdditional) {
            additionalFields.push({
              sectionKey: section.sectionKey,
              innerSectionKey: inner.sectionKey,
              fieldKey: field.key,
              value: val,
            });
          } else {
            if (!profileUpdates[section.sectionKey])
              profileUpdates[section.sectionKey] = {};
            if (!profileUpdates[section.sectionKey][inner.sectionKey]) {
              profileUpdates[section.sectionKey][inner.sectionKey] = {};
            }
            profileUpdates[section.sectionKey][inner.sectionKey][field.key] =
              val;
          }
        }
      }
    }

    return { profileUpdates, additionalFields };
  }

  useEffect(() => {
    if (!employeeId) return;

    const fetchData = async () => {
      try {
        const [{ data: empRes }, { data: configRes }] = await Promise.all([
          axiosInstance.get(`/employees/${employeeId}`),
          axiosInstance.get("/employee-field-config"),
        ]);

        const profile = empRes.data.employeeProfile;
        const configSections = configRes.data.sections;

        const values: Record<string, any> = {};

        for (const section of configSections) {
          const group = section.sectionKey;

          // Address special case
          if (group === "address") {
            values[group] =
              profile[group] && Array.isArray(profile[group])
                ? profile[group]
                : [{}];
            continue;
          }

          // Top-level fields
          for (const field of section.fields) {
            let val;
            if (field.isAdditional) {
              // Find value from additionalFields
              const match = empRes.data.additionalFields.find(
                (f: any) =>
                  f.sectionKey === section.sectionKey &&
                  f.innerSectionKey === null &&
                  f.fieldKey === field.key
              );
              val = match?.value;
            } else {
              val = get(profile, `${group}.${field.key}`);
            }

            set(
              values,
              `${group}.${field.key}`,
              val ??
                (field.type === "checkbox"
                  ? false
                  : field.type === "file"
                    ? {}
                    : "")
            );
          }

          // Inner sections
          for (const inner of section.innerSections || []) {
            for (const field of inner.fields) {
              let val;
              if (field.isAdditional) {
                const match = empRes.data.additionalFields.find(
                  (f: any) =>
                    f.sectionKey === section.sectionKey &&
                    f.innerSectionKey === inner.sectionKey &&
                    f.fieldKey === field.key
                );
                val = match?.value;
              } else {
                val = get(profile, `${group}.${inner.sectionKey}.${field.key}`);
              }

              set(
                values,
                `${group}.${inner.sectionKey}.${field.key}`,
                val ??
                  (field.type === "checkbox"
                    ? false
                    : field.type === "file"
                      ? {}
                      : "")
              );
            }
          }
        }

        setProfileId(profile._id);
        setSections(configSections);
        setInitialValues(values);
        setLoading(false);

        // Build initial selectedDocuments
        const initialSelectedDocs: Record<string, string> = {};

        for (const section of configSections) {
          for (const inner of section.innerSections || []) {
            if (inner.requirementMode === "OR") {
              const groupPath = `${section.sectionKey}.${inner.sectionKey}`;

              const selected = inner.fields.find((field: any) => {
                let val;
                if (field.isAdditional) {
                  const match = empRes.data.additionalFields.find(
                    (f: any) =>
                      f.sectionKey === section.sectionKey &&
                      f.innerSectionKey === inner.sectionKey &&
                      f.fieldKey === field.key
                  );
                  val = match?.value;
                } else {
                  val = get(
                    profile,
                    `${section.sectionKey}.${inner.sectionKey}.${field.key}`
                  );
                }

                return (
                  val &&
                  (typeof val === "string" ||
                    (typeof val === "object" && Object.keys(val).length > 0))
                );
              });

              if (selected) {
                initialSelectedDocs[groupPath] = selected.key;
              }
            }
          }
        }

        setSelectedDocuments(initialSelectedDocs);
      } catch (err) {
        console.error("Failed to load profile", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [employeeId]);

  function deepCleanFileFields(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .map(deepCleanFileFields)
        .filter((val) => val !== undefined && val !== null);
    }

    if (typeof obj === "object" && obj !== null) {
      const cleaned: any = {};
      for (const key in obj) {
        const val = obj[key];

        if (
          val === "" || // Remove empty strings
          (typeof val === "object" && // Remove empty objects
            val !== null &&
            Object.keys(val).length === 0)
        ) {
          continue;
        }

        if (val instanceof Date) {
          cleaned[key] = val;
        } else if (typeof val === "object") {
          const nested = deepCleanFileFields(val);
          if (
            nested !== null &&
            nested !== undefined &&
            (typeof nested !== "object" || Object.keys(nested).length > 0)
          ) {
            cleaned[key] = nested;
          }
        } else {
          cleaned[key] = val;
        }
      }
      return cleaned;
    }

    return obj;
  }

  const evaluateShowIf = (field: any) => {
    if (!field.showIf) return true;
    const findFieldValue = (obj: any, key: string): any => {
      if (typeof obj !== "object" || obj === null) return undefined;
      if (key in obj) return obj[key];
      for (const k of Object.keys(obj)) {
        const result = findFieldValue(obj[k], key);
        if (result !== undefined) return result;
      }
      return undefined;
    };
    const actualValue = findFieldValue(formik.values, field.showIf.fieldKey);
    return field.showIf.operator === "equals"
      ? actualValue === field.showIf.value
      : actualValue !== field.showIf.value;
  };

  const renderAddressSection = (fields: any[]) => {
    const addresses = formik.values.address || [];

    const handleAdd = () => {
      const newList = [...addresses, {}];
      formik.setFieldValue("address", newList);
      autoSave({ ...formik.values, address: newList });
    };

    const handleRemove = (i: number) => {
      const newList = addresses.filter((_, idx) => idx !== i);
      formik.setFieldValue("address", newList);
      autoSave({ ...formik.values, address: newList });
    };

    return (
      <div className="space-y-6">
        {addresses.map((address: any, index: number) => {
          return (
            <Card
              key={index}
              className="relative border border-gray-200 shadow-md p-0 overflow-hidden"
            >
              {/* Top bar with editable addressFor */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
                <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-sm">
                  <div className="relative">
                    <input
                      type="text"
                      id={`addressFor-${index}`}
                      className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent"
                      placeholder="e.g., Home, Office"
                      value={address?.addressFor || ""}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[index] = {
                          ...updated[index],
                          addressFor: e.target.value,
                        };
                        formik.setFieldValue("address", updated);
                      }}
                      onBlur={() => {
                        const updated = [...addresses];
                        updated[index] = {
                          ...updated[index],
                          addressFor: addresses[index]?.addressFor || "",
                        };
                        formik.setFieldValue("address", updated);
                        autoSave({ ...formik.values, address: updated });
                      }}
                    />
                    <label
                      htmlFor={`addressFor-${index}`}
                      className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold"
                    >
                      Address Label (e.g., Home, Office)
                    </label>
                  </div>
                </div>

                {addresses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="ml-4 text-red-500 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Address fields */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields
                  .filter((f: any) => f.key !== "addressFor")
                  .map((field: any) => (
                    <Input
                      key={`address[${index}].${field.key}`}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={formik.values.address[index]?.[field.key] || ""}
                      onChange={(e) => {
                        const newAddresses = [...addresses];
                        newAddresses[index] = {
                          ...newAddresses[index],
                          [field.key]: e.target.value,
                        };
                        formik.setFieldValue("address", newAddresses);
                      }}
                      onBlur={() => {
                        formik.setFieldTouched(
                          `address[${index}].${field.key}`,
                          true
                        );
                        autoSave(formik.values);
                      }}
                    />
                  ))}
              </div>
            </Card>
          );
        })}
        <Button variant="outline" onClick={handleAdd}>
          + Add Address
        </Button>
      </div>
    );
  };

  function FileUploadField({
    field,
    fullPath,
    value,
    formik,
    autoSave,
    renderHint,
    renderError,
  }: {
    field: any;
    fullPath: string;
    value: any;
    formik: any;
    autoSave: (values: any) => void;
    renderHint: () => JSX.Element;
    renderError: () => JSX.Element;
  }) {
    const fileMetaElements = [];
    const fileMeta = field.fileMeta || {};

    const isImage = (url: string) =>
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);

    const onDrop = useCallback(
      async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        try {
          const formData = new FormData();
          formData.append("file", file);

          const { data } = await axiosInstance.post("/uploads", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
          const fileUrl = data?.url || data?.data?.url;
          if (!fileUrl) throw new Error("No file URL returned.");

          const updated = { ...formik.values };
          set(updated, `${fullPath}.url`, fileUrl);
          formik.setFieldValue(`${fullPath}.url`, fileUrl);
          autoSave(updated);
          toast.success("File Uploaded");
        } catch (err) {
          console.error("Upload error:", err);
          toast.error("Upload failed");
        }
      },
      [fullPath, formik, autoSave]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      multiple: false,
      accept: {
        "application/pdf": [],
        "image/*": [],
      },
    });

    if (fileMeta.expiryDate) {
      fileMetaElements.push(
        <div key={`${fullPath}.expiryDate`} className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Expiry Date
          </label>
          <ReactDatePicker
            selected={value?.expiryDate ? new Date(value.expiryDate) : null}
            onChange={(val) => {
              formik.setFieldValue(
                `${fullPath}.expiryDate`,
                val?.toISOString() || null
              );
              autoSave(formik.values);
            }}
          />
        </div>
      );
    }

    if (fileMeta.issuingDate) {
      fileMetaElements.push(
        <div key={`${fullPath}.issuingDate`} className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Issue Date
          </label>
          <ReactDatePicker
            selected={value?.issuingDate ? new Date(value.issuingDate) : null}
            onChange={(val) => {
              formik.setFieldValue(
                `${fullPath}.issuingDate`,
                val?.toISOString() || null
              );
              autoSave(formik.values);
            }}
          />
        </div>
      );
    }

    if (fileMeta.referenceNumber) {
      fileMetaElements.push(
        <div key={`${fullPath}.referenceNumber`} className="space-y-1">
          <Input
            label="Reference Number"
            value={value?.referenceNumber || ""}
            onChange={(e) => {
              formik.setFieldValue(
                `${fullPath}.referenceNumber`,
                e.target.value
              );
              autoSave(formik.values);
            }}
          />
        </div>
      );
    }

    const fileUrl = value?.url || "";

    return (
      <div
        key={fullPath}
        className="space-y-4 border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
      >
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-800">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>

        {fileUrl && (
          <div className="mb-2">
            {isImage(fileUrl) ? (
              <div className="flex flex-col items-start gap-2">
                <img
                  src={fileUrl}
                  alt="Uploaded Preview"
                  className="max-w-xs max-h-48 rounded border shadow"
                />
                <span className="text-sm text-gray-500">
                  {decodeURIComponent(fileUrl.split("/").pop() || "file")}
                </span>
              </div>
            ) : (
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
          </div>
        )}

        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-4 py-6 transition cursor-pointer
    ${
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
                  {isImage(fileUrl) ? "Image uploaded" : "File uploaded"} ✔
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

        {fileMetaElements.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fileMetaElements}
          </div>
        )}
        {renderHint()}
        {renderError()}
      </div>
    );
  }

  const renderField = (field: any, pathPrefix: string) => {
    if (!evaluateShowIf(field)) return null;

    const fullPath = `${pathPrefix}.${field.key}`;
    const value = get(formik.values, fullPath);
    const error = get(formik.errors, fullPath);
    const touched = get(formik.touched, fullPath);
    const showError = Boolean(touched && error);

    const renderHint = () =>
      field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>;

    const renderError = () =>
      showError && <p className="text-xs text-red-500 mt-1">{error}</p>;

    switch (field.type) {
      case "text":
      case "email":
        return (
          <div key={fullPath}>
            <Input
              type={field.type}
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              placeholder={field.placeholder}
              required={field.required}
              value={value}
              onBlur={(e) => {
                formik.handleBlur(e);
                autoSave(formik.values);
              }}
              onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "textarea":
        return (
          <div key={fullPath}>
            <Textarea
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              placeholder={field.placeholder}
              required={field.required}
              value={value}
              onBlur={(e) => {
                formik.handleBlur(e);
                autoSave(formik.values);
              }}
              onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "checkbox":
        return (
          <div key={fullPath}>
            <Checkbox
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              checked={value}
              onBlur={(e) => {
                formik.handleBlur(e);
                autoSave(formik.values);
              }}
              onChange={(e) => formik.setFieldValue(fullPath, e.target.checked)}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "date":
        const isDOB = field.key === "dob";
        let ageText = "";

        if (isDOB && value) {
          const dob = new Date(value);
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
            age--;
          }
          ageText = ` (${age} years old)`;
        }

        const currentYear = new Date().getFullYear();
        const maxDOBDate = new Date();
        maxDOBDate.setFullYear(currentYear - 18);

        return (
          <div key={fullPath} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {field.label}
              {ageText}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <ReactDatePicker
              selected={value ? new Date(value) : null}
              showMonthDropdown
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={100}
              dateFormat="dd/MM/yy"
              maxDate={isDOB ? maxDOBDate : undefined}
              onChange={(val) => {
                if (val) {
                  const iso = val.toISOString();

                  // Update Formik
                  formik.setFieldValue(fullPath, iso);

                  // Update age if DOB
                  if (isDOB) {
                    const now = new Date();
                    const dob = new Date(val);
                    let age = now.getFullYear() - dob.getFullYear();
                    const m = now.getMonth() - dob.getMonth();
                    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
                      age--;
                    }
                    formik.setFieldValue("personaldetails.age", age);
                  }

                  // Save updated value
                  const updated = { ...formik.values };
                  set(updated, fullPath, iso);
                  autoSave(updated);
                }
              }}
              inputProps={{ placeholder: field.placeholder }}
              onBlur={() => {
                formik.setFieldTouched(fullPath, true);
              }}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "number":
        return (
          <div key={fullPath}>
            <Input
              type="number"
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              placeholder={field.placeholder}
              required={field.required}
              value={value}
              onBlur={(e) => {
                formik.handleBlur(e);
                autoSave(formik.values);
              }}
              onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
              disabled={fullPath === "personaldetails.age"}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "select":
        return (
          <div key={fullPath}>
            <Select
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              placeholder={field.placeholder}
              required={field.required}
              value={field.options
                .map((o: string) => ({ label: o, value: o }))
                .find((opt) => opt.value === value)}
              onChange={(opt: any) =>
                formik.setFieldValue(fullPath, opt?.value || "")
              }
              options={field.options.map((o: string) => ({
                label: o,
                value: o,
              }))}
              onBlur={() => {
                formik.setFieldTouched(fullPath, true);
                autoSave(formik.values);
              }}
            />
            {renderHint()}
            {renderError()}
          </div>
        );

      case "reference": {
        const modelOptions = referenceOptions[field.referenceModel] || [];

        return (
          <div key={fullPath}>
            <Select
              label={
                <>
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </>
              }
              placeholder={field.placeholder}
              value={
                modelOptions.find(
                  (opt) =>
                    String(opt.value) ===
                    String(typeof value === "object" ? value._id : value)
                ) || null
              }
              onChange={(opt: any) => {
                const selectedId = opt?.value || "";
                formik.setFieldValue(fullPath, selectedId);

                const updated = { ...formik.values };
                set(updated, fullPath, selectedId);

                autoSave(updated);
              }}
              options={modelOptions}
              onBlur={() => {
                formik.setFieldTouched(fullPath, true);
              }}
            />
            {renderHint()}
            {renderError()}
          </div>
        );
      }

      case "file": {
        return (
          <FileUploadField
            field={field}
            fullPath={fullPath}
            value={value}
            formik={formik}
            autoSave={autoSave}
            renderHint={renderHint}
            renderError={renderError}
          />
        );
      }

      default:
        return null;
    }
  };

  const renderDocumentSection = (innerSection: any, sectionKeyPath: string) => {
    const mode = innerSection.requirementMode || "AND";
    const uniqueKey = sectionKeyPath;

    if (mode === "OR") {
      const selectedKey = selectedDocuments[uniqueKey];

      return (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Select a document to upload
          </p>

          <Select
            placeholder="Choose document"
            value={innerSection.fields
              .map((f: any) => ({ label: f.label, value: f.key }))
              .find((opt) => opt.value === selectedKey)}
            onChange={(opt) =>
              setSelectedDocuments((prev) => ({
                ...prev,
                [uniqueKey]: opt?.value,
              }))
            }
            options={innerSection.fields.map((f: any) => ({
              label: f.label,
              value: f.key,
            }))}
          />

          {selectedKey && (
            <div className="mt-4">
              {renderField(
                innerSection.fields.find((f: any) => f.key === selectedKey),
                sectionKeyPath
              )}
            </div>
          )}
        </div>
      );
    }

    // AND Mode: Show all fields
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {innerSection.fields.map((field: any) =>
          renderField(field, sectionKeyPath)
        )}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading profile...</div>;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <Card className="p-6 sm:p-8 space-y-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Complete Employee Profile
        </h2>
        <div className="text-sm flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-blue-500">💾 Saving...</span>
          )}
          {saveStatus === "success" && (
            <span className="text-green-600">✅ Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-500">⚠️ Error while saving</span>
          )}
          {saveStatus === "idle" && (
            <span className="text-gray-400">Auto-save enabled</span>
          )}
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-6">
          <Tab>
            <Tab.List className="gap-2 border-b pb-2 mb-4">
              {sections.map((section) => (
                <Tab.ListItem
                  key={section.sectionKey}
                  className="text-sm font-medium px-4 py-2 rounded-md"
                >
                  {section.sectionLabel}
                </Tab.ListItem>
              ))}
            </Tab.List>
            <Tab.Panels>
              {sections.map((section) => (
                <Tab.Panel key={section.sectionKey}>
                  {section.sectionKey === "address" ? (
                    renderAddressSection(section.fields)
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {section.fields.map((field: any) =>
                        renderField(field, section.sectionKey)
                      )}
                    </div>
                  )}

                  {section.innerSections?.map((inner: any) => (
                    <div
                      key={inner.sectionKey}
                      className="mt-8 border-t border-gray-200 pt-6"
                    >
                      <h4 className="text-base font-medium text-gray-700 mb-4">
                        {inner.sectionLabel}
                      </h4>

                      {section.sectionKey === "documents" ? (
                        renderDocumentSection(
                          inner,
                          `${section.sectionKey}.${inner.sectionKey}`
                        )
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {inner.fields.map((field: any) =>
                            renderField(
                              field,
                              `${section.sectionKey}.${inner.sectionKey}`
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab>
          {/* <Button type="submit">Save Profile</Button> */}
        </form>
      </Card>
    </div>
  );
}

// const handleDrop = useCallback(
//   async (acceptedFiles: File[], fieldPath: string) => {
//     const file = acceptedFiles[0];
//     if (!file) return;

//     try {
//       const dummyUrl =
//         "https://t3.ftcdn.net/jpg/04/87/71/80/360_F_487718054_JqW6dNomEaualaFwfvse9E2w8xyCYw86.jpg"; // Replace with real upload logic
//       const updated = { ...formik.values };
//       set(updated, `${fieldPath}.url`, dummyUrl);
//       formik.setFieldValue(`${fieldPath}.url`, dummyUrl);
//       autoSave(updated);
//       toast.success("Document Uploaded");
//     } catch (err) {
//       console.error("Upload error:", err);
//       toast.error("Upload failed");
//     }
//   },
//   [formik, autoSave]
// );

// function FileUploadField({
//   field,
//   fullPath,
//   value,
//   formik,
//   autoSave,
//   renderHint,
//   renderError,
// }: {
//   field: any;
//   fullPath: string;
//   value: any;
//   formik: any;
//   autoSave: (values: any) => void;
//   renderHint: () => JSX.Element;
//   renderError: () => JSX.Element;
// }) {
//   const fileMetaElements = [];
//   const fileMeta = field.fileMeta || {};

//   const onDrop = useCallback(
//     async (acceptedFiles: File[]) => {
//       const file = acceptedFiles[0];
//       if (!file) return;
//       console.log(file, "here");
//       try {
//         const formData = new FormData();
//         formData.append("file", file);

//         const { data } = await axiosInstance.post("/uploads", formData, {
//           headers: {
//             "Content-Type": "multipart/form-data", // OPTIONAL: Axios usually handles this automatically.
//           },
//         });
//         const fileUrl = data?.url || data?.data?.url;

//         if (!fileUrl) {
//           throw new Error("Upload response missing file URL.");
//         }

//         const updated = { ...formik.values };
//         set(updated, `${fullPath}.url`, fileUrl);
//         formik.setFieldValue(`${fullPath}.url`, fileUrl);
//         autoSave(updated);
//         toast.success("File Uploaded");
//       } catch (err) {
//         console.error("Upload error:", err);
//         toast.error("Upload failed");
//       }
//     },
//     [fullPath, formik, autoSave]
//   );

//   const { getRootProps, getInputProps, isDragActive } = useDropzone({
//     onDrop,
//     multiple: false,
//     accept: {
//       "application/pdf": [],
//       "image/*": [],
//     },
//   });

//   if (fileMeta.expiryDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.expiryDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">
//           Expiry Date
//         </label>
//         <ReactDatePicker
//           selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.expiryDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.issuingDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.issuingDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">
//           Issuing Date
//         </label>
//         <ReactDatePicker
//           selected={value?.issuingDate ? new Date(value.issuingDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.issuingDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.referenceNumber) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.referenceNumber`} className="space-y-1">
//         <Input
//           label="Reference Number"
//           value={value?.referenceNumber || ""}
//           onChange={(e) => {
//             formik.setFieldValue(
//               `${fullPath}.referenceNumber`,
//               e.target.value
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   return (
//     <div
//       key={fullPath}
//       className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50"
//     >
//       <div className="flex justify-between items-center">
//         <label className="block text-sm font-medium text-gray-800">
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </label>
//         {value?.url && (
//           <div className="flex items-center gap-2 text-sm text-gray-700">
//             <a
//               href={value.url}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition"
//             >
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-4 w-4"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//               View File
//             </a>
//             <span className="text-gray-500 italic truncate max-w-[200px]">
//               {decodeURIComponent(value.url.split("/").pop() || "file")}
//             </span>
//           </div>
//         )}
//       </div>

//       <div
//         {...getRootProps()}
//         className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-4 py-6 transition cursor-pointer
//     ${
//       isDragActive
//         ? "border-blue-500 bg-blue-50"
//         : "border-gray-300 bg-white hover:border-gray-400"
//     }`}
//       >
//         <input {...getInputProps()} />
//         {value?.url ? (
//           <div className="flex flex-col items-center text-center text-sm text-green-700">
//             <div className="flex items-center gap-1 mb-1">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-4 w-4 text-green-600"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M5 13l4 4L19 7"
//                 />
//               </svg>
//               <span>File uploaded successfully</span>
//             </div>
//             <span className="text-gray-500">
//               Drag a new file to replace or click to browse
//             </span>
//           </div>
//         ) : (
//           <div className="text-center text-sm text-gray-600">
//             <div className="mb-1">No file uploaded</div>
//             <span>
//               Drag & drop a file here or{" "}
//               <span className="text-blue-600 underline cursor-pointer">
//                 browse
//               </span>
//             </span>
//           </div>
//         )}
//       </div>

//       {fileMetaElements.length > 0 && (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {fileMetaElements}
//         </div>
//       )}
//       {renderHint()}
//       {renderError()}
//     </div>
//   );
// }

// case "file": {
//   const fileMetaElements = [];
//   const fileMeta = field.fileMeta || {};

//   if (fileMeta.expiryDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.expiryDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">
//           Expiry Date
//         </label>
//         <ReactDatePicker
//           selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.expiryDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.issuingDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.issuingDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">
//           Issuing Date
//         </label>
//         <ReactDatePicker
//           selected={
//             value?.issuingDate ? new Date(value.issuingDate) : null
//           }
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.issuingDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.referenceNumber) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.referenceNumber`} className="space-y-1">
//         <Input
//           label="Reference Number"
//           value={value?.referenceNumber || ""}
//           onChange={(e) => {
//             formik.setFieldValue(
//               `${fullPath}.referenceNumber`,
//               e.target.value
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   return (
//     <div
//       key={fullPath}
//       className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50"
//     >
//       <div className="flex justify-between items-center">
//         <label className="block text-sm font-medium text-gray-800">
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </label>
//         {value?.url && (
//           <a
//             href={value.url}
//             target="_blank"
//             rel="noopener noreferrer"
//             className="text-sm text-blue-600 underline"
//           >
//             View File
//           </a>
//         )}
//       </div>

//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition">
//         <p className="text-sm text-gray-500">
//           {value?.url ? "File uploaded." : "No file uploaded"}
//         </p>
//         <label className="mt-2 sm:mt-0 inline-flex items-center cursor-pointer text-sm font-medium text-gray-700 border border-gray-300 bg-white px-3 py-1.5 rounded-md hover:bg-gray-100 transition">
//           Upload File
//           <input
//             type="file"
//             accept={field.fileTypes
//               ?.map((t: string) => `.${t}`)
//               .join(",")}
//             className="hidden"
//             onChange={async (e) => {
//               const file = e.target.files?.[0];
//               if (!file) return;

//               try {
//                 const dummyUrl = "https://dummy-url.com/sample.pdf"; // Replace with real upload logic
//                 const updated = { ...formik.values };
//                 set(updated, `${fullPath}.url`, dummyUrl);
//                 formik.setFieldValue(`${fullPath}.url`, dummyUrl);
//                 autoSave(updated);
//               } catch (err) {
//                 console.error("Upload error:", err);
//                 toast.error("Upload failed");
//               }
//             }}
//           />
//         </label>
//       </div>

//       {fileMetaElements.length > 0 && (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {fileMetaElements}
//         </div>
//       )}
//       {renderHint()}
//       {renderError()}
//     </div>
//   );
// }

// const onDrop = useCallback(
//   async (acceptedFiles: File[]) => {
//     const file = acceptedFiles[0];
//     if (!file) return;
//     try {
//       const formData = new FormData();
//       formData.append("file", file);
//       const { data } = await axiosInstance.post("/uploads", formData);
//       const fileUrl = data.url;
//       const updated = { ...formik.values };
//       set(updated, `${fullPath}.url`, fileUrl);
//       formik.setFieldValue(`${fullPath}.url`, fileUrl);
//       autoSave(updated);
//     } catch (err) {
//       console.error("Upload error:", err);
//       toast.error("Upload failed");
//     }
//   },
//   [fullPath, formik, autoSave]
// );

// case "file": {
//   const fileMetaElements = [];
//   const fileMeta = field.fileMeta || {};

//   if (fileMeta.expiryDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.expiryDate`}>
//         <label className="block text-sm font-medium text-gray-700">
//           Expiry Date
//         </label>
//         <ReactDatePicker
//           selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.expiryDate`,
//               val ? val.toISOString() : null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.issuingDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.issuingDate`}>
//         <label className="block text-sm font-medium text-gray-700">
//           Issuing Date
//         </label>
//         <ReactDatePicker
//           selected={
//             value?.issuingDate ? new Date(value.issuingDate) : null
//           }
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.issuingDate`,
//               val ? val.toISOString() : null
//             );
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   if (fileMeta.referenceNumber) {
//     fileMetaElements.push(
//       <Input
//         key={`${fullPath}.referenceNumber`}
//         label="Reference Number"
//         value={value?.referenceNumber || ""}
//         onChange={(e) => {
//           formik.setFieldValue(
//             `${fullPath}.referenceNumber`,
//             e.target.value
//           );
//           autoSave(formik.values);
//         }}
//       />
//     );
//   }

//   return (
//     <div key={fullPath} className="space-y-4">
//       <label className="block text-sm font-medium text-gray-700">
//         {field.label}
//         {field.required && <span className="text-red-500 ml-1">*</span>}
//       </label>
//       <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//         <div className="flex flex-col">
//           {value?.url ? (
//             <a
//               href={value.url}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-sm text-blue-600 underline"
//             >
//               View Uploaded Document
//             </a>
//           ) : (
//             <p className="text-sm text-gray-500">No file uploaded</p>
//           )}
//           {renderHint()}
//           {renderError()}
//         </div>
//         <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//           Browse
//           <input
//             type="file"
//             accept={field.fileTypes
//               ?.map((t: string) => `.${t}`)
//               .join(",")}
//             className="hidden"
//             onChange={async (e) => {
//               const file = e.target.files?.[0];
//               if (!file) return;

//               try {
//                 const dummyUrl =
//                   "https://t4.ftcdn.net/jpg/02/24/86/95/360_F_224869519_aRaeLneqALfPNBzg0xxMZXghtvBXkfIA.jpg";

//                 const updatedValues = { ...formik.values };
//                 set(updatedValues, `${fullPath}.url`, dummyUrl);

//                 formik.setFieldValue(`${fullPath}.url`, dummyUrl);
//                 autoSave(updatedValues); // ✅ pass manually updated copy
//               } catch (err) {
//                 console.error("File upload failed", err);
//                 alert("Upload failed. Try again.");
//               }
//             }}
//           />
//         </label>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//         {fileMetaElements}
//       </div>
//     </div>
//   );
// }

// function splitProfileAndAdditionalFields(
//   values: any,
//   sections: any[]
// ): {
//   profileUpdates: any;
//   additionalFields: any[];
// } {
//   const profileUpdates: any = {};
//   const additionalFields: any[] = [];

//   for (const section of sections) {
//     const sectionGroup = values[section.sectionKey];
//     if (!sectionGroup) continue;

//     // Top-level fields
//     for (const field of section.fields || []) {
//       const val = sectionGroup[field.key];

//       // ✅ Special handling for address
//       if (section.sectionKey === "address") {
//         profileUpdates["address"] = values["address"];
//         break; // Exit loop since entire address array is assigned
//       }

//       // ✅ Fix: Always add field to profileUpdates if section is not "documents"
//       if (section.sectionKey !== "documents") {
//         if (!profileUpdates[section.sectionKey])
//           profileUpdates[section.sectionKey] = {};
//         profileUpdates[section.sectionKey][field.key] = val;
//       }

//       if (field.isAdditional) {
//         additionalFields.push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           fieldKey: field.key,
//           value: val,
//         });
//       }
//     }

//     // Inner sections
//     for (const inner of section.innerSections || []) {
//       const innerGroup = sectionGroup?.[inner.sectionKey];
//       if (!innerGroup) continue;

//       for (const field of inner.fields || []) {
//         const val = innerGroup[field.key];

//         if (section.sectionKey !== "documents") {
//           if (!profileUpdates[section.sectionKey])
//             profileUpdates[section.sectionKey] = {};
//           if (!profileUpdates[section.sectionKey][inner.sectionKey]) {
//             profileUpdates[section.sectionKey][inner.sectionKey] = {};
//           }
//           profileUpdates[section.sectionKey][inner.sectionKey][field.key] =
//             val;
//         }

//         if (field.isAdditional) {
//           additionalFields.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//             value: val,
//           });
//         }
//       }
//     }
//   }

//   return { profileUpdates, additionalFields };
// }

// function splitProfileAndAdditionalFields(
//   values: any,
//   sections: any[]
// ): {
//   profileUpdates: any;
//   additionalFields: any[];
// } {
//   const profileUpdates: any = {};
//   const additionalFields: any[] = [];

//   for (const section of sections) {
//     const sectionGroup = values[section.sectionKey];
//     if (!sectionGroup) continue;

//     // Top-level fields
//     for (const field of section.fields || []) {
//       const val = sectionGroup[field.key];
//       if (field.isAdditional) {
//         additionalFields.push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           fieldKey: field.key,
//           value: val,
//         });
//       } else {
//         if (!profileUpdates[section.sectionKey])
//           profileUpdates[section.sectionKey] = {};
//         profileUpdates[section.sectionKey][field.key] = val;
//       }
//     }

//     // Inner sections
//     for (const inner of section.innerSections || []) {
//       const innerGroup = sectionGroup?.[inner.sectionKey];
//       if (!innerGroup) continue;

//       for (const field of inner.fields || []) {
//         const val = innerGroup[field.key];
//         if (field.isAdditional) {
//           additionalFields.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//             value: val,
//           });
//         } else {
//           if (!profileUpdates[section.sectionKey])
//             profileUpdates[section.sectionKey] = {};
//           if (!profileUpdates[section.sectionKey][inner.sectionKey]) {
//             profileUpdates[section.sectionKey][inner.sectionKey] = {};
//           }
//           profileUpdates[section.sectionKey][inner.sectionKey][field.key] =
//             val;
//         }
//       }
//     }
//   }

//   return { profileUpdates, additionalFields };
// }

// useEffect(() => {
//   const fetchOptions = async () => {
//     try {
//       const res = await axiosInstance.get(`/employees`);
//       const data = res.data?.data || [];
//       const opts = data.map((emp: any) => ({
//         label: emp?.employeeProfile?.personaldetails?.firstname || "Unnamed",
//         value: emp._id, // this is important
//       }));
//       setOptions(opts);
//     } catch (err) {
//       console.error("Failed to fetch reference options", err);
//     }
//   };
//   fetchOptions();
// }, []);

// const renderAddressSection = (fields: any[]) => {
//   const addresses = formik.values.address || [];

//   const handleAdd = () => {
//     const newList = [...addresses, {}];
//     formik.setFieldValue("address", newList);
//     autoSave({ ...formik.values, address: newList });
//   };

//   const handleRemove = (i: number) => {
//     const newList = addresses.filter((_, idx) => idx !== i);
//     formik.setFieldValue("address", newList);
//     autoSave({ ...formik.values, address: newList });
//   };

//   return (
//     <div className="space-y-6">
//       {addresses.map((address: any, index: number) => (
//         <Card
//           key={index}
//           className="p-4 relative border border-gray-200 shadow-sm"
//         >
//           {addresses.length > 1 && (
//             <button
//               type="button"
//               onClick={() => handleRemove(index)}
//               className="absolute top-2 right-2 text-red-500 hover:text-red-600 text-sm"
//             >
//               Remove
//             </button>
//           )}
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             {fields.map((field: any) => (
//               <Input
//                 key={`address[${index}].${field.key}`}
//                 label={field.label}
//                 placeholder={field.placeholder}
//                 value={formik.values.address[index]?.[field.key] || ""}
//                 onChange={(e) => {
//                   const newAddresses = [...addresses];
//                   newAddresses[index] = {
//                     ...newAddresses[index],
//                     [field.key]: e.target.value,
//                   };
//                   formik.setFieldValue("address", newAddresses);
//                 }}
//                 onBlur={() => {
//                   formik.setFieldTouched(
//                     `address[${index}].${field.key}`,
//                     true
//                   );
//                   autoSave(formik.values);
//                 }}
//               />
//             ))}
//           </div>
//         </Card>
//       ))}
//       <Button variant="outline" onClick={handleAdd}>
//         + Add Address
//       </Button>
//     </div>
//   );
// };

// case "reference": {
//   return (
//     <div key={fullPath}>
//       <Select
//         label={
//           <>
//             {field.label}
//             {field.required && (
//               <span className="text-red-500 ml-1">*</span>
//             )}
//           </>
//         }
//         placeholder={field.placeholder}
//         value={
//           options.find(
//             (opt) =>
//               String(opt.value) ===
//               String(
//                 typeof value === "object" && value !== null
//                   ? value._id
//                   : value
//               )
//           ) || null
//         }
//         onChange={(opt: any) => {
//           const selectedId = opt?.value || "";
//           formik.setFieldValue(fullPath, selectedId);

//           const updated = { ...formik.values };
//           set(updated, fullPath, selectedId);

//           autoSave(updated);
//         }}
//         options={options}
//         onBlur={() => {
//           formik.setFieldTouched(fullPath, true);
//         }}
//       />
//       {renderHint()}
//       {renderError()}
//     </div>
//   );
// }

// onChange={async (e) => {
//   const file = e.target.files?.[0];
//   if (!file) return;
//   try {
//     const formData = new FormData();
//     formData.append("file", file);

//     formik.setFieldValue(
//       `${fullPath}.url`,
//       "https://t4.ftcdn.net/jpg/02/24/86/95/360_F_224869519_aRaeLneqALfPNBzg0xxMZXghtvBXkfIA.jpg"
//     );
//     autoSave(formik.values); // auto-save after file is set
//   } catch (err) {
//     console.error("File upload failed", err);
//     alert("Upload failed. Try again.");
//   }
// }}

// case "date":
//   return (
//     <div key={fullPath} className="space-y-1">
//       <label className="text-sm font-medium text-gray-700">
//         {field.label}
//         {field.required && <span className="text-red-500 ml-1">*</span>}
//       </label>
//       <ReactDatePicker
//         selected={value ? new Date(value) : null}
//         showMonthDropdown
//         showYearDropdown
//         dateFormat="dd/MM/yy"
//         onChange={(val) => {
//           if (val) {
//             formik.setFieldValue(fullPath, val.toISOString());
//             if (field.key === "dob") {
//               const today = new Date();
//               const dob = new Date(val);
//               let age = today.getFullYear() - dob.getFullYear();
//               const m = today.getMonth() - dob.getMonth();
//               if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
//                 age--;
//               }
//               formik.setFieldValue("personaldetails.age", age);
//             }
//           }
//         }}
//         inputProps={{ placeholder: field.placeholder }}
//         onBlur={() => {
//           formik.setFieldTouched(fullPath, true);
//           autoSave(formik.values);
//         }}
//       />
//       {renderHint()}
//       {renderError()}
//     </div>
//   );

// const { data } = await axiosInstance.post("/uploads", formData);
// formik.setFieldValue(`${fullPath}.url`, data.url);

// for (const section of configSections) {
//   const group = section.sectionKey;
//   if (group === "address") {
//     values[group] =
//       profile[group] && Array.isArray(profile[group])
//         ? profile[group]
//         : [{}];
//   } else {
//     section.fields.forEach((field: any) => {
//       const val = get(profile, `${group}.${field.key}`);
//       set(
//         values,
//         `${group}.${field.key}`,
//         val ?? (field.type === "checkbox" ? false : "")
//       );
//     });

//     section.innerSections?.forEach((inner: any) => {
//       inner.fields.forEach((field: any) => {
//         const val = get(
//           profile,
//           `${group}.${inner.sectionKey}.${field.key}`
//         );
//         set(
//           values,
//           `${group}.${inner.sectionKey}.${field.key}`,
//           val ?? (field.type === "checkbox" ? false : "")
//         );
//       });
//     });
//   }
// }

// const renderField = (field: any, pathPrefix: string) => {
//   if (!evaluateShowIf(field)) return null;
//   const fullPath = `${pathPrefix}.${field.key}`;
//   const value = get(formik.values, fullPath);
//   const renderHint = () =>
//     field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>;

//   switch (field.type) {
//     case "text":
//     case "number":
//     case "email":
//       return (
//         <div key={fullPath}>
//           <Input
//             type={field.type}
//             label={
//               <>
//                 {field.label}
//                 {field.required && (
//                   <span className="text-red-500 ml-1">*</span>
//                 )}
//               </>
//             }
//             placeholder={field.placeholder}
//             required={field.required}
//             value={value}
//             onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//           />
//           {renderHint()}
//         </div>
//       );
//     case "textarea":
//       return (
//         <div key={fullPath}>
//           <Textarea
//             label={
//               <>
//                 {field.label}
//                 {field.required && (
//                   <span className="text-red-500 ml-1">*</span>
//                 )}
//               </>
//             }
//             placeholder={field.placeholder}
//             required={field.required}
//             value={value}
//             onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//           />
//           {renderHint()}
//         </div>
//       );
//     case "checkbox":
//       return (
//         <div key={fullPath}>
//           <Checkbox
//             label={
//               <>
//                 {field.label}
//                 {field.required && (
//                   <span className="text-red-500 ml-1">*</span>
//                 )}
//               </>
//             }
//             checked={value}
//             onChange={(e) => formik.setFieldValue(fullPath, e.target.checked)}
//           />
//           {renderHint()}
//         </div>
//       );
//     case "date":
//       return (
//         <div key={fullPath} className="space-y-1">
//           <label className="text-sm font-medium text-gray-700">
//             {field.label}{" "}
//             {field.required && <span className="text-red-500">*</span>}
//           </label>
//           <ReactDatePicker
//             selected={value ? new Date(value) : null}
//             showMonthDropdown
//             showYearDropdown
//             onChange={(val) => {
//               formik.setFieldValue(fullPath, val.toISOString());
//               // auto-calculate age if DOB is updated
//               if (field.key === "dob") {
//                 const today = new Date();
//                 const dob = new Date(val);
//                 let age = today.getFullYear() - dob.getFullYear();
//                 const m = today.getMonth() - dob.getMonth();
//                 if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
//                   age--;
//                 }
//                 formik.setFieldValue("personaldetails.age", age);
//               }
//             }}
//             inputProps={{ placeholder: field.placeholder }}
//           />
//           {renderHint()}
//         </div>
//       );

//     case "number":
//       return (
//         <div key={fullPath}>
//           <Input
//             type="number"
//             label={
//               <>
//                 {field.label}
//                 {field.required && (
//                   <span className="text-red-500 ml-1">*</span>
//                 )}
//               </>
//             }
//             placeholder={field.placeholder}
//             required={field.required}
//             value={value}
//             onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//             disabled={fullPath === "personaldetails.age"}
//           />
//           {renderHint()}
//         </div>
//       );
//     case "select":
//       return (
//         <div key={fullPath}>
//           <Select
//             label={
//               <>
//                 {field.label}
//                 {field.required && (
//                   <span className="text-red-500 ml-1">*</span>
//                 )}
//               </>
//             }
//             placeholder={field.placeholder}
//             required={field.required}
//             value={field.options
//               .map((o: string) => ({ label: o, value: o }))
//               .find((opt) => opt.value === value)}
//             onChange={(opt: any) =>
//               formik.setFieldValue(fullPath, opt?.value || "")
//             }
//             options={field.options.map((o: string) => ({
//               label: o,
//               value: o,
//             }))}
//           />
//           {renderHint()}
//         </div>
//       );

//     case "file": {
//       const fileMetaElements = [];
//       const fileMeta = field.fileMeta || {};

//       if (fileMeta.expiryDate) {
//         fileMetaElements.push(
//           <div key={`${fullPath}.expiryDate`}>
//             <label className="block text-sm font-medium text-gray-700">
//               Expiry Date
//             </label>
//             <ReactDatePicker
//               selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//               onChange={(val: Date | null) =>
//                 formik.setFieldValue(
//                   `${fullPath}.expiryDate`,
//                   val ? val.toISOString() : null
//                 )
//               }
//             />
//           </div>
//         );
//       }

//       if (fileMeta.issuingDate) {
//         fileMetaElements.push(
//           <div key={`${fullPath}.issuingDate`}>
//             <label className="block text-sm font-medium text-gray-700">
//               Issuing Date
//             </label>

//             <ReactDatePicker
//               selected={
//                 value?.issuingDate ? new Date(value.issuingDate) : null
//               }
//               onChange={(val) =>
//                 formik.setFieldValue(
//                   `${fullPath}.issuingDate`,
//                   val.toISOString() ?? null
//                 )
//               }
//             />
//           </div>
//         );
//       }

//       if (fileMeta.referenceNumber) {
//         fileMetaElements.push(
//           <Input
//             key={`${fullPath}.referenceNumber`}
//             label="Reference Number"
//             value={value?.referenceNumber || ""}
//             onChange={(e) =>
//               formik.setFieldValue(
//                 `${fullPath}.referenceNumber`,
//                 e.target.value
//               )
//             }
//           />
//         );
//       }

//       return (
//         <div key={fullPath} className="space-y-4">
//           <label className="block text-sm font-medium text-gray-700">
//             {field.label}{" "}
//             {field.required && <span className="text-red-500">*</span>}
//           </label>
//           <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//             <div className="flex flex-col">
//               {value?.url ? (
//                 <a
//                   href={value.url}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="text-sm text-blue-600 underline"
//                 >
//                   View Uploaded Document
//                 </a>
//               ) : (
//                 <p className="text-sm text-gray-500">No file uploaded</p>
//               )}
//               {renderHint()}
//             </div>
//             <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//               Browse
//               <input
//                 type="file"
//                 accept={field.fileTypes
//                   ?.map((t: string) => `.${t}`)
//                   .join(",")}
//                 className="hidden"
//                 onChange={async (e) => {
//                   const file = e.target.files?.[0];
//                   if (!file) return;
//                   try {
//                     const formData = new FormData();
//                     formData.append("file", file);
//                     // const { data } = await axiosInstance.post("/uploads", formData);
//                     // formik.setFieldValue(`${fullPath}.url`, data.url);
//                     formik.setFieldValue(
//                       `${fullPath}.url`,
//                       "https://t4.ftcdn.net/jpg/02/24/86/95/360_F_224869519_aRaeLneqALfPNBzg0xxMZXghtvBXkfIA.jpg"
//                     );
//                   } catch (err) {
//                     console.error("File upload failed", err);
//                     alert("Upload failed. Try again.");
//                   }
//                 }}
//               />
//             </label>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//             {fileMetaElements}
//           </div>
//         </div>
//       );
//     }

//     default:
//       return null;
//   }
// };

{
  /* {section.innerSections?.map((inner: any) => (
                    <div
                      key={inner.sectionKey}
                      className="mt-8 border-t border-gray-200 pt-6"
                    >
                      <h4 className="text-base font-medium text-gray-700 mb-4">
                        {inner.sectionLabel}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {inner.fields.map((field: any) =>
                          renderField(
                            field,
                            `${section.sectionKey}.${inner.sectionKey}`
                          )
                        )}
                      </div>
                    </div>
                  ))} */
}

// <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//   <Card className="p-6 sm:p-8 space-y-8">
//     <h2 className="text-xl font-semibold text-gray-900 mb-2">
//       Complete Employee Profile
//     </h2>
//     <form onSubmit={formik.handleSubmit} className="space-y-6">
//       <Tab>
//         <Tab.List className="gap-2 border-b pb-2 mb-4">
//           {sections.map((section) => (
//             <Tab.ListItem
//               key={section.sectionKey}
//               className="text-sm font-medium px-4 py-2 rounded-md"
//             >
//               {section.sectionLabel}
//             </Tab.ListItem>
//           ))}
//         </Tab.List>
//         <Tab.Panels>
//           {sections.map((section) => (
//             <Tab.Panel key={section.sectionKey}>
//               {section.sectionKey === "address" ? (
//                 renderAddressSection(section.fields)
//               ) : (
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   {section.fields.map((field: any) =>
//                     renderField(field, section.sectionKey)
//                   )}
//                 </div>
//               )}

//               {section.innerSections?.map((inner: any) => (
//                 <div
//                   key={inner.sectionKey}
//                   className="mt-8 border-t border-gray-200 pt-6"
//                 >
//                   <h4 className="text-base font-medium text-gray-700 mb-4">
//                     {inner.sectionLabel}
//                   </h4>
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                     {inner.fields.map((field: any) =>
//                       renderField(
//                         field,
//                         `${section.sectionKey}.${inner.sectionKey}`
//                       )
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </Tab.Panel>
//           ))}
//         </Tab.Panels>
//       </Tab>
//       <Button type="submit">Save Profile</Button>
//     </form>
//   </Card>
// </div>

// ---------------
// "use client";

// import { useEffect, useState } from "react";
// import { useParams } from "next/navigation";
// import { Input, Select, Button, Textarea, Checkbox, Tab } from "rizzui";
// import { useFormik } from "formik";
// import axiosInstance from "@/app/lib/axios";
// import ReactDatePicker from "@/app/components/ui/DatePicker";
// import { Card } from "@/app/components/ui/Card";
// import set from "lodash/set";
// import get from "lodash/get";

// export default function EmployeeProfileForm() {
//   const params = useParams();
//   const employeeId = params?.id as string;

//   const [sections, setSections] = useState<any[]>([]);
//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [profileId, setProfileId] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (!employeeId) return;

//     const fetchData = async () => {
//       try {
//         const [{ data: empRes }, { data: configRes }] = await Promise.all([
//           axiosInstance.get(`/employees/${employeeId}`),
//           axiosInstance.get("/employee-field-config"),
//         ]);

//         const profile = empRes.data.employeeProfile;
//         const configSections = configRes.data.sections;

//         const values: Record<string, any> = {};

//         for (const section of configSections) {
//           const group = section.sectionKey;
//           section.fields.forEach((field: any) => {
//             const val = get(profile, `${group}.${field.key}`);
//             set(
//               values,
//               `${group}.${field.key}`,
//               val ?? (field.type === "checkbox" ? false : "")
//             );
//           });

//           section.innerSections?.forEach((inner: any) => {
//             inner.fields.forEach((field: any) => {
//               const val = get(
//                 profile,
//                 `${group}.${inner.sectionKey}.${field.key}`
//               );
//               set(
//                 values,
//                 `${group}.${inner.sectionKey}.${field.key}`,
//                 val ?? (field.type === "checkbox" ? false : "")
//               );
//             });
//           });
//         }

//         setProfileId(profile._id);
//         setSections(configSections);
//         setInitialValues(values);
//         setLoading(false);
//       } catch (err) {
//         console.error("Failed to load profile", err);
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [employeeId]);

//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     onSubmit: async (values) => {
//       try {
//         await axiosInstance.put(`/employee-profiles/${profileId}`, values);
//         alert("Profile updated successfully");
//       } catch (err) {
//         console.error("Update failed", err);
//         alert("Update failed");
//       }
//     },
//   });
//   //   if (!field.showIf) return true;
//   //   const value = get(formik.values, field.showIf.fieldKey);
//   //   return field.showIf.operator === "equals"
//   //     ? value === field.showIf.value
//   //     : value !== field.showIf.value;
//   // };

//   const evaluateShowIf = (field: any) => {
//     if (!field.showIf) return true;

//     // Recursively search the formik.values to find matching key
//     const findFieldValue = (obj: any, key: string): any => {
//       if (typeof obj !== "object" || obj === null) return undefined;
//       if (key in obj) return obj[key];

//       for (const k of Object.keys(obj)) {
//         const result = findFieldValue(obj[k], key);
//         if (result !== undefined) return result;
//       }
//       return undefined;
//     };

//     const actualValue = findFieldValue(formik.values, field.showIf.fieldKey);

//     return field.showIf.operator === "equals"
//       ? actualValue === field.showIf.value
//       : actualValue !== field.showIf.value;
//   };

//   const renderField = (field: any, pathPrefix: string) => {
//     if (!evaluateShowIf(field)) return null;

//     const fullPath = `${pathPrefix}.${field.key}`;
//     const value = get(formik.values, fullPath);

//     const renderHint = () =>
//       field.hint ? (
//         <p className="text-xs text-gray-400 mt-1">{field.hint}</p>
//       ) : null;

//     switch (field.type) {
//       case "text":
//       case "number":
//       case "email":
//         return (
//           <div key={fullPath}>
//             <Input
//               type={field.type}
//               label={field.label}
//               placeholder={field.placeholder}
//               required={field.required}
//               value={value}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "textarea":
//         return (
//           <div key={fullPath}>
//             <Textarea
//               label={field.label}
//               placeholder={field.placeholder}
//               required={field.required}
//               value={value}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "checkbox":
//         return (
//           <div key={fullPath}>
//             <Checkbox
//               label={field.label}
//               checked={value}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.checked)}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "date":
//         return (
//           <div key={fullPath} className="space-y-1">
//             <label className="text-sm font-medium text-gray-700">
//               {field.label}{" "}
//               {field.required && <span className="text-red-500">*</span>}
//             </label>
//             <br />
//             <ReactDatePicker
//               selected={value ? new Date(value) : null}
//               onChange={(val) => formik.setFieldValue(fullPath, val)}
//               inputProps={{ placeholder: field.placeholder }}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "select":
//         return (
//           <div key={fullPath}>
//             <Select
//               label={field.label}
//               placeholder={field.placeholder}
//               required={field.required}
//               value={field.options
//                 .map((o: string) => ({ label: o, value: o }))
//                 .find((opt: any) => opt.value === value)}
//               onChange={(option: any) =>
//                 formik.setFieldValue(fullPath, option?.value || "")
//               }
//               options={field.options.map((o: string) => ({
//                 label: o,
//                 value: o,
//               }))}
//             />
//             {renderHint()}
//           </div>
//         );
//       case "file":
//         return (
//           <div key={fullPath} className="space-y-1">
//             <label className="block text-sm font-medium text-gray-700">
//               {field.label}{" "}
//               {field.required && <span className="text-red-500">*</span>}
//             </label>
//             <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//               <div className="flex flex-col">
//                 {value ? (
//                   <a
//                     href={value}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="text-sm text-blue-600 underline"
//                   >
//                     View Uploaded Document
//                   </a>
//                 ) : (
//                   <p className="text-sm text-gray-500">No file uploaded</p>
//                 )}
//                 {renderHint()}
//               </div>
//               <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//                 Browse
//                 <input
//                   type="file"
//                   accept={field.fileTypes
//                     ?.map((t: string) => `.${t}`)
//                     .join(",")}
//                   className="hidden"
//                   onChange={async (e) => {
//                     const file = e.target.files?.[0];
//                     if (!file) return;
//                     try {
//                       const formData = new FormData();
//                       formData.append("file", file);
//                       const { data } = await axiosInstance.post(
//                         "/uploads",
//                         formData,
//                         {
//                           headers: { "Content-Type": "multipart/form-data" },
//                         }
//                       );
//                       formik.setFieldValue(fullPath, data.url);
//                     } catch (err) {
//                       console.error("File upload failed", err);
//                       alert("Upload failed. Try again.");
//                     }
//                   }}
//                 />
//               </label>
//             </div>
//           </div>
//         );
//       default:
//         return null;
//     }
//   };

//   if (loading) return <div className="p-6">Loading profile...</div>;

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8">
//         <h2 className="text-xl font-semibold text-gray-900 mb-2">
//           Edit Employee Profile
//         </h2>
//         <form onSubmit={formik.handleSubmit} className="space-y-6">
//           <Tab>
//             <Tab.List className="gap-2 border-b pb-2 mb-4">
//               {sections.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="text-sm font-medium px-4 py-2 rounded-md"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>
//             <Tab.Panels>
//               {sections.map((section) => (
//                 <Tab.Panel key={section.sectionKey}>
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                     {section.fields.map((field: any) =>
//                       renderField(field, section.sectionKey)
//                     )}
//                   </div>
//                   {section.innerSections?.map((inner: any) => (
//                     <div
//                       key={inner.sectionKey}
//                       className="mt-8 border-t border-gray-200 pt-6"
//                     >
//                       <h4 className="text-base font-medium text-gray-700 mb-4">
//                         {inner.sectionLabel}
//                       </h4>
//                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                         {inner.fields.map((field: any) =>
//                           renderField(
//                             field,
//                             `${section.sectionKey}.${inner.sectionKey}`
//                           )
//                         )}
//                       </div>
//                     </div>
//                   ))}
//                 </Tab.Panel>
//               ))}
//             </Tab.Panels>
//           </Tab>
//           <Button type="submit">Save Profile</Button>
//         </form>
//       </Card>
//     </div>
//   );
// }

// case "file":
//   return (
//     <div key={fullPath} className="space-y-1">
//       <label className="block text-sm font-medium text-gray-700">
//         {field.label}{" "}
//         {field.required && <span className="text-red-500">*</span>}
//       </label>
//       <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//         <div className="flex flex-col">
//           {value ? (
//             <a
//               href={value}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-sm text-blue-600 underline"
//             >
//               View Uploaded Document
//             </a>
//           ) : (
//             <p className="text-sm text-gray-500">No file uploaded</p>
//           )}
//           {renderHint()}
//         </div>
//         <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//           Browse
//           <input
//             type="file"
//             accept={field.fileTypes
//               ?.map((t: string) => `.${t}`)
//               .join(",")}
//             className="hidden"
//             onChange={async (e) => {
//               const file = e.target.files?.[0];
//               if (!file) return;
//               try {
//                 const formData = new FormData();
//                 formData.append("file", file);
//                 // const { data } = await axiosInstance.post(
//                 //   "/uploads",
//                 //   formData,
//                 //   {
//                 //     headers: { "Content-Type": "multipart/form-data" },
//                 //   }
//                 // );
//                 // formik.setFieldValue(fullPath, data.url);
//                 formik.setFieldValue(
//                   fullPath,
//                   "https://t4.ftcdn.net/jpg/02/24/86/95/360_F_224869519_aRaeLneqALfPNBzg0xxMZXghtvBXkfIA.jpg"
//                 );
//               } catch (err) {
//                 console.error("File upload failed", err);
//                 alert("Upload failed. Try again.");
//               }
//             }}
//           />
//         </label>
//       </div>
//     </div>
//   );

// case "file":
//   const fileMetaElements = [];
//   const fileMeta = field.fileMeta || {};

//   if (fileMeta.expiryDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.expiryDate`}>
//         <label className="block text-sm font-medium text-gray-700">
//           Expiry Date
//         </label>
//         <ReactDatePicker
//           selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//           onChange={(val) =>
//             formik.setFieldValue(`${fullPath}.expiryDate`, val)
//           }
//         />
//       </div>
//     );
//   }

//   if (fileMeta.issuingDate) {
//     fileMetaElements.push(
//       <div key={`${fullPath}.issuingDate`}>
//         <label className="block text-sm font-medium text-gray-700">
//           Issuing Date
//         </label>
//         <ReactDatePicker
//           selected={
//             value?.issuingDate ? new Date(value.issuingDate) : null
//           }
//           onChange={(val) =>
//             formik.setFieldValue(`${fullPath}.issuingDate`, val)
//           }
//         />
//       </div>
//     );
//   }

//   if (fileMeta.referenceNumber) {
//     fileMetaElements.push(
//       <Input
//         key={`${fullPath}.referenceNumber`}
//         label="Reference Number"
//         value={value?.referenceNumber || ""}
//         onChange={(e) =>
//           formik.setFieldValue(
//             `${fullPath}.referenceNumber`,
//             e.target.value
//           )
//         }
//       />
//     );
//   }

//   if (typeof fileMeta.points === "number") {
//     fileMetaElements.push(
//       <Input
//         key={`${fullPath}.points`}
//         type="number"
//         label="Points"
//         value={value?.points || 0}
//         onChange={(e) =>
//           formik.setFieldValue(`${fullPath}.points`, e.target.value)
//         }
//       />
//     );
//   }

//   if (Array.isArray(fileMeta.mandatoryStatus)) {
//     fileMetaElements.push(
//       <Select
//         key={`${fullPath}.mandatoryStatus`}
//         label="Mandatory Status"
//         value={fileMeta.mandatoryStatus
//           .map((opt: string) => ({ label: opt, value: opt }))
//           .find((opt) => opt.value === value?.mandatoryStatus)}
//         onChange={(option: any) =>
//           formik.setFieldValue(
//             `${fullPath}.mandatoryStatus`,
//             option.value
//           )
//         }
//         options={fileMeta.mandatoryStatus.map((opt: string) => ({
//           label: opt,
//           value: opt,
//         }))}
//       />
//     );
//   }

//   return (
//     <div key={fullPath} className="space-y-1">
//       <label className="block text-sm font-medium text-gray-700">
//         {field.label}
//         {field.required && <span className="text-red-500">*</span>}
//       </label>
//       <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50 hover:border-gray-400 transition-colors">
//         <div className="flex flex-col">
//           {value?.url ? (
//             <a
//               href={value.url}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-sm text-blue-600 underline"
//             >
//               View Uploaded Document
//             </a>
//           ) : (
//             <p className="text-sm text-gray-500">No file uploaded</p>
//           )}
//           {renderHint()}
//         </div>
//         <label className="ml-4 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-100 transition">
//           Browse
//           <input
//             type="file"
//             accept={field.fileTypes
//               ?.map((t: string) => `.${t}`)
//               .join(",")}
//             className="hidden"
//             onChange={async (e) => {
//               const file = e.target.files?.[0];
//               if (!file) return;
//               try {
//                 const formData = new FormData();
//                 formData.append("file", file);
//                 // const { data } = await axiosInstance.post("/uploads", formData);
//                 // formik.setFieldValue(`${fullPath}.url`, data.url);
//                 formik.setFieldValue(
//                   `${fullPath}.url`,
//                   "https://t4.ftcdn.net/jpg/02/24/86/95/360_F_224869519_aRaeLneqALfPNBzg0xxMZXghtvBXkfIA.jpg"
//                 );
//               } catch (err) {
//                 console.error("File upload failed", err);
//                 alert("Upload failed. Try again.");
//               }
//             }}
//           />
//         </label>
//       </div>

//       {/* File Meta Fields */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
//         {fileMetaElements}
//       </div>
//     </div>
//   );
