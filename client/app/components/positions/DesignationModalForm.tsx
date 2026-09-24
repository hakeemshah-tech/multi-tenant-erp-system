"use client";

import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Input, Button, MultiSelect } from "rizzui";
import { X, ChevronDown, ChevronRight, Edit2, Briefcase } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import axiosInstance from "@/app/lib/axios";

interface DepartmentOption {
  label: string;
  value: string;
}

interface DocumentField {
  label: string;
  key: string;
  sectionKey: string;
  innerSectionKey?: string;
  innerSectionLabel?: string;
}

interface DesignationFormData {
  _id?: string;
  name: string;
  departmentIds: string[];
  roleIds: string[]; // Array of role IDs
  selectedDocumentFields: string[]; // Array of document field identifiers
}

interface RoleLevel {
  _id: string;
  level: number;
  name: string;
  description?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DesignationFormData;
  canEdit?: boolean; // Control if user can edit (based on write permission)
}

export default function DesignationModalForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  canEdit = true, // Default to true for backward compatibility
}: Props) {
  // If initialData exists, start in view mode; otherwise, start in edit mode (for new designations)
  // But respect canEdit prop - if false, always stay in view mode
  const [isEditMode, setIsEditMode] = useState(!initialData && canEdit);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [roles, setRoles] = useState<DepartmentOption[]>([]); // Using same interface for roles
  const [loading, setLoading] = useState(false);
  const [documentFields, setDocumentFields] = useState<DocumentField[]>([]);
  // Track which accordion sections are open (initially all open)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Reset edit mode when modal opens/closes or initialData changes
  // But respect canEdit prop - if false, always stay in view mode
  useEffect(() => {
    if (isOpen) {
      setIsEditMode(!initialData && canEdit);
    }
  }, [isOpen, initialData, canEdit]);

  // Extract all document fields from the config
  useEffect(() => {
    const fetchDocumentFields = async () => {
      try {
        const { data } = await axiosInstance.get("/employee-field-config");
        const sections = data?.data?.sections || [];

        // Find the "documents" section
        const documentsSection = sections.find(
          (section: { sectionKey?: string }) =>
            section.sectionKey?.toLowerCase() === "documents"
        );

        if (!documentsSection) {
          setDocumentFields([]);
          return;
        }

        const fields: DocumentField[] = [];
        const selectedFields: string[] = [];

        // Extract from inner sections (like certificates, checks)
        if (documentsSection.innerSections) {
          documentsSection.innerSections.forEach(
            (innerSection: {
              sectionKey?: string;
              label?: string;
              fields?: Array<{
                label: string;
                key: string;
                jobRole?: string[];
              }>;
            }) => {
              if (innerSection.fields) {
                innerSection.fields.forEach((field) => {
                  const fieldId = `documents.${innerSection.sectionKey}.${field.key}`;
                  const isCurrentlySelected = field.jobRole?.includes(
                    initialData?._id || ""
                  );

                  fields.push({
                    label: field.label,
                    key: field.key,
                    sectionKey: "documents",
                    innerSectionKey: innerSection.sectionKey,
                    innerSectionLabel:
                      innerSection.label || innerSection.sectionKey || "",
                  });

                  // Collect all selected fields for editing
                  if (initialData?._id && isCurrentlySelected) {
                    selectedFields.push(fieldId);
                  }
                });
              }
            }
          );
        }

        // If editing and we found selected fields, update formik
        if (initialData?._id && selectedFields.length > 0) {
          formik.setFieldValue("selectedDocumentFields", selectedFields);
          console.log(
            "🔍 [DEBUG] Pre-populated selected documents:",
            selectedFields
          );
        }

        console.log("🔍 [DEBUG] Extracted document fields:", fields);
        setDocumentFields(fields);

        // Initialize all sections as open
        const sectionKeys = new Set(
          fields.map((f) => f.innerSectionKey || "other")
        );
        setOpenSections(sectionKeys);
      } catch (error) {
        console.error("Failed to load document fields:", error);
        setDocumentFields([]);
      }
    };

    if (isOpen) {
      fetchDocumentFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData?._id]);

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const formik = useFormik<DesignationFormData>({
    initialValues: {
      _id: initialData?._id,
      name: initialData?.name || "",
      departmentIds: initialData?.departmentIds || [],
      roleIds: initialData?.roleIds || [],
      selectedDocumentFields: initialData?.selectedDocumentFields || [],
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      name: Yup.string().required("Designation name is required"),
      departmentIds: Yup.array()
        .of(Yup.string())
        .min(1, "Select at least one department"),
    }),
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const { selectedDocumentFields, ...designationData } = values;

        console.log(
          "🔍 [DEBUG] Frontend - Selected documents:",
          selectedDocumentFields
        );
        console.log("🔍 [DEBUG] Frontend - Full payload:", {
          ...designationData,
          selectedDocumentFields,
        });

        if (values._id) {
          const updatePayload = {
            ...designationData,
            selectedDocumentFields, // Include selected documents for updates too
          };
          await axiosInstance.put(`/designations/${values._id}`, updatePayload);
          toast.success("Job Title updated successfully");
        } else {
          const response = await axiosInstance.post("/designations", {
            ...designationData,
            selectedDocumentFields, // Send selected documents
          });
          console.log("🔍 [DEBUG] Frontend - Response:", response.data);
          toast.success("Job Title created successfully");
        }
        onSuccess();
        onClose();
        setIsEditMode(false);
      } catch (error: unknown) {
        console.error("❌ [DEBUG] Frontend - Error:", error);
        const errorMessage =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to save Job Title";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
  });

  const handleClose = () => {
    setIsEditMode(false);
    onClose();
  };

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axiosInstance.get("/departments");
        setDepartments(
          res.data.data.map((d: { _id: string; name: string }) => ({
            label: d.name,
            value: d._id,
          }))
        );
      } catch {
        toast.error("Failed to load departments");
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axiosInstance.get("/roles");
        const fetchedRoles = res.data.data || [];
        // Filter out system_admin as it has full access by default
        const filteredRoles = fetchedRoles.filter(
          (role: any) => role.roleId !== "system_admin"
        );
        setRoles(
          filteredRoles.map((role: { roleId: string; name: string }) => ({
            label: role.name,
            value: role.roleId,
          }))
        );
      } catch {
        toast.error("Failed to load roles");
      }
    };
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  console.log("values--", formik.values);

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" onClose={() => {}} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-4xl">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                      <Dialog.Title className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        {isEditMode
                          ? formik.values._id
                            ? "Edit Job Title"
                            : "Add Job Title"
                          : "Job Title Details"}
                      </Dialog.Title>
                      <div className="flex items-center gap-2">
                        {!isEditMode && initialData && canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditMode(true)}
                            className="flex items-center gap-1.5"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Button>
                        )}
                        <button
                          onClick={handleClose}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                          aria-label="Close"
                        >
                          <X size={22} />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                      {isEditMode ? (
                        /* Form Content */
                        <form
                          onSubmit={formik.handleSubmit}
                          className="px-6 py-6 space-y-6"
                        >
                          {/* Job Title Input */}
                          <div className="space-y-2">
                            <Input
                              label="Job Title Name"
                              name="name"
                              placeholder="Enter Job Title name"
                              value={formik.values.name}
                              onChange={formik.handleChange}
                              error={
                                formik.touched.name ? formik.errors.name : ""
                              }
                              className="w-full"
                            />
                          </div>

                          {/* Departments MultiSelect */}
                          <div className="space-y-2">
                            <MultiSelect
                              label="Departments"
                              options={departments}
                              value={
                                Array.isArray(formik.values.departmentIds)
                                  ? (formik.values.departmentIds as string[])
                                  : []
                              }
                              onChange={(selected: string[]) =>
                                formik.setFieldValue("departmentIds", selected)
                              }
                              placeholder="Select departments"
                              error={
                                formik.touched.departmentIds
                                  ? typeof formik.errors.departmentIds ===
                                    "string"
                                    ? formik.errors.departmentIds
                                    : ""
                                  : ""
                              }
                            />
                          </div>

                          {/* Roles MultiSelect */}
                          <div className="space-y-2">
                            <MultiSelect
                              label="Roles"
                              options={roles}
                              value={
                                Array.isArray(formik.values.roleIds)
                                  ? (formik.values.roleIds as string[])
                                  : []
                              }
                              onChange={(selected: string[]) =>
                                formik.setFieldValue("roleIds", selected)
                              }
                              placeholder="Select roles (optional)"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Select roles to assign to this job title.
                              Employees with this job title will inherit these
                              roles.
                            </p>
                          </div>

                          {/* Document Selection Section */}
                          {documentFields.length > 0 && (
                            <div className="border-t border-gray-200 pt-6 mt-6">
                              <div className="mb-4">
                                <label className="text-base font-semibold text-gray-900 block mb-2">
                                  Required Documents
                                </label>
                                <p className="text-sm text-gray-500">
                                  Select which documents are required for this
                                  Job Title
                                </p>
                              </div>
                              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl p-4 bg-gray-50/50 shadow-inner">
                                {(() => {
                                  // Group fields by inner section
                                  const groupedBySection =
                                    documentFields.reduce(
                                      (acc, field) => {
                                        const sectionKey =
                                          field.innerSectionKey || "other";
                                        if (!acc[sectionKey]) {
                                          acc[sectionKey] = {
                                            label:
                                              field.innerSectionLabel ||
                                              sectionKey,
                                            fields: [],
                                          };
                                        }
                                        acc[sectionKey].fields.push(field);
                                        return acc;
                                      },
                                      {} as Record<
                                        string,
                                        {
                                          label: string;
                                          fields: DocumentField[];
                                        }
                                      >
                                    );

                                  return Object.entries(groupedBySection).map(
                                    ([sectionKey, { label, fields }]) => {
                                      const isOpen =
                                        openSections.has(sectionKey);
                                      return (
                                        <div
                                          key={sectionKey}
                                          className="mb-3 last:mb-0 border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm"
                                        >
                                          {/* Accordion Header */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleSection(sectionKey)
                                            }
                                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                          >
                                            <h4 className="text-sm font-semibold text-gray-900">
                                              {label}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-gray-500 font-medium">
                                                {fields.length}{" "}
                                                {fields.length === 1
                                                  ? "document"
                                                  : "documents"}
                                              </span>
                                              {isOpen ? (
                                                <ChevronDown className="w-4 h-4 text-gray-600" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                              )}
                                            </div>
                                          </button>

                                          {/* Accordion Content */}
                                          {isOpen && (
                                            <div className="px-4 py-3 space-y-2.5 border-t border-gray-200 bg-white">
                                              {fields.map((field) => {
                                                const fieldId = `${
                                                  field.sectionKey
                                                }.${
                                                  field.innerSectionKey || ""
                                                }.${field.key}`;
                                                const isChecked =
                                                  formik.values.selectedDocumentFields.includes(
                                                    fieldId
                                                  );

                                                return (
                                                  <div
                                                    key={fieldId}
                                                    className="flex items-center px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      id={`doc-${fieldId}`}
                                                      checked={isChecked}
                                                      onChange={(e) => {
                                                        const current =
                                                          formik.values
                                                            .selectedDocumentFields;
                                                        const updated = e.target
                                                          .checked
                                                          ? [
                                                              ...current,
                                                              fieldId,
                                                            ]
                                                          : current.filter(
                                                              (id) =>
                                                                id !== fieldId
                                                            );
                                                        formik.setFieldValue(
                                                          "selectedDocumentFields",
                                                          updated
                                                        );
                                                      }}
                                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                                    />
                                                    <label
                                                      htmlFor={`doc-${fieldId}`}
                                                      className="ml-3 text-sm text-gray-700 cursor-pointer select-none flex-1"
                                                    >
                                                      {field.label}
                                                    </label>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Footer Actions */}
                          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            {formik.values._id && (
                              <Button
                                type="button"
                                onClick={() => {
                                  setIsEditMode(false);
                                  // Reset to initial data values
                                  formik.setValues({
                                    _id: initialData?._id,
                                    name: initialData?.name || "",
                                    departmentIds:
                                      initialData?.departmentIds || [],
                                    roleIds: initialData?.roleIds || [],
                                    selectedDocumentFields:
                                      initialData?.selectedDocumentFields || [],
                                  });
                                  formik.setTouched({});
                                  formik.setErrors({});
                                }}
                                variant="outline"
                                className="px-6 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </Button>
                            )}
                            <Button
                              type="submit"
                              disabled={loading}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading
                                ? formik.values._id
                                  ? "Updating..."
                                  : "Creating..."
                                : formik.values._id
                                  ? "Update Job Title"
                                  : "Create Job Title"}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        /* View Mode */
                        <div className="px-6 py-6 space-y-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-gray-500 mb-1 block">
                                Job Title Name
                              </label>
                              <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900 font-medium">
                                  {formik.values.name || "—"}
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-500 mb-1 block">
                                Departments
                              </label>
                              <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[60px]">
                                {formik.values.departmentIds.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {formik.values.departmentIds.map(
                                      (deptId) => {
                                        const dept = departments.find(
                                          (d) => d.value === deptId
                                        );
                                        return dept ? (
                                          <span
                                            key={deptId}
                                            className="border border-blue-600 text-blue-600 text-xs px-3 py-1 rounded-full bg-blue-50"
                                          >
                                            {dept.label}
                                          </span>
                                        ) : null;
                                      }
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    No departments assigned
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-500 mb-1 block">
                                Roles
                              </label>
                              <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[60px]">
                                {formik.values.roleIds &&
                                formik.values.roleIds.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {formik.values.roleIds.map((roleId) => {
                                      const role = roles.find(
                                        (r) => r.value === roleId
                                      );
                                      return role ? (
                                        <span
                                          key={roleId}
                                          className="border border-purple-600 text-purple-600 text-xs px-3 py-1 rounded-full bg-purple-50"
                                        >
                                          {role.label}
                                        </span>
                                      ) : null;
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    No roles assigned
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-500 mb-1 block">
                                Required Documents
                              </label>
                              <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[80px]">
                                {documentFields.length > 0 &&
                                formik.values.selectedDocumentFields.length >
                                  0 ? (
                                  <div className="space-y-2">
                                    {(() => {
                                      const selectedFields =
                                        documentFields.filter((field) =>
                                          formik.values.selectedDocumentFields.includes(
                                            `documents.${field.innerSectionKey}.${field.key}`
                                          )
                                        );
                                      const grouped = selectedFields.reduce(
                                        (acc, field) => {
                                          const sectionKey =
                                            field.innerSectionKey || "other";
                                          if (!acc[sectionKey]) {
                                            acc[sectionKey] = {
                                              label:
                                                field.innerSectionLabel ||
                                                sectionKey,
                                              fields: [],
                                            };
                                          }
                                          acc[sectionKey].fields.push(field);
                                          return acc;
                                        },
                                        {} as Record<
                                          string,
                                          {
                                            label: string;
                                            fields: DocumentField[];
                                          }
                                        >
                                      );
                                      return Object.entries(grouped).map(
                                        ([key, { label, fields }]) => (
                                          <div key={key} className="mb-3">
                                            <p className="text-xs font-semibold text-gray-600 mb-1">
                                              {label}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {fields.map((field) => (
                                                <span
                                                  key={field.key}
                                                  className="text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-700"
                                                >
                                                  {field.label}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    No required documents set
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
