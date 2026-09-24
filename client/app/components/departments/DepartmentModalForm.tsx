"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Input, Button } from "rizzui";
import { useFormik } from "formik";
import { X, Edit2, Building2 } from "lucide-react";
import * as Yup from "yup";
import { toast } from "react-toastify";
import axiosInstance from "@/app/lib/axios";

interface DepartmentFormData {
  _id?: string;
  name: string;
  description?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DepartmentFormData;
  canEdit?: boolean; // Permission to edit/create
}

export default function DepartmentModalForm({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  canEdit = true, // Default to true for backward compatibility
}: Props) {
  // If initialData exists, start in view mode; otherwise, start in edit mode (for new departments)
  // But only if user has edit permission
  const [isEditMode, setIsEditMode] = useState(!initialData && canEdit);

  // Reset edit mode when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      setIsEditMode(!initialData && canEdit);
    }
  }, [isOpen, initialData, canEdit]);

  const formik = useFormik<DepartmentFormData>({
    initialValues: {
      _id: initialData?._id,
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      name: Yup.string().required("Department name is required"),
    }),
    onSubmit: async (values) => {
      try {
        if (values._id) {
          await axiosInstance.put(`/departments/${values._id}`, values);
          toast.success("Department updated successfully");
        } else {
          await axiosInstance.post("/departments", values);
          toast.success("Department created successfully");
        }
        onSuccess();
        onClose();
        setIsEditMode(false);
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message || "Failed to save department";
        toast.error(errorMessage);
      }
    },
  });

  const handleClose = () => {
    setIsEditMode(false);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}} static>
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

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex justify-between items-center mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    {isEditMode
                      ? formik.values._id
                        ? "Edit Department"
                        : "Add Department"
                      : "Department Details"}
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
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {isEditMode ? (
                  <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <Input
                      label="Department Name"
                      name="name"
                      value={formik.values.name}
                      onChange={formik.handleChange}
                      error={formik.touched.name ? formik.errors.name : ""}
                      placeholder="Enter department name"
                    />

                    <Input
                      label="Description"
                      name="description"
                      value={formik.values.description}
                      onChange={formik.handleChange}
                      placeholder="Enter department description"
                    />

                    <div className="mt-6 flex justify-end gap-3">
                      {formik.values._id && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditMode(false);
                            // Reset to initial data values
                            formik.setValues({
                              _id: initialData?._id,
                              name: initialData?.name || "",
                              description: initialData?.description || "",
                            });
                            formik.setTouched({});
                            formik.setErrors({});
                          }}
                          className="rounded-full px-6"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
                      >
                        {formik.values._id ? "Update" : "Add"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Department Name
                        </label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-gray-900 font-medium">
                            {formik.values.name || "—"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-1 block">
                          Description
                        </label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[80px]">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {formik.values.description || (
                              <span className="text-gray-400 italic">
                                No description provided
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
