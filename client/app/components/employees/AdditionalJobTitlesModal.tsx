"use client";

import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, MultiSelect } from "rizzui";
import { X, Briefcase } from "lucide-react";
import { toast } from "react-toastify";
import axiosInstance from "@/app/lib/axios";

interface Designation {
  _id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  currentPrimaryDesignationId?: string;
  currentAdditionalDesignationIds?: string[];
  allDesignations?: Designation[]; // Pre-fetched designations to avoid API calls
  isLoadingDesignations?: boolean; // Loading state from parent
  onSuccess: () => void;
}

export default function AdditionalJobTitlesModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentPrimaryDesignationId,
  currentAdditionalDesignationIds = [],
  allDesignations = [],
  isLoadingDesignations = false,
  onSuccess,
}: Props) {
  const [selectedDesignationIds, setSelectedDesignationIds] = useState<
    string[]
  >(currentAdditionalDesignationIds);
  const [loading, setLoading] = useState(false);

  // Use provided designations or empty array
  const allDesignationsList = allDesignations || [];

  // Find primary designation name
  const primaryDesignation = allDesignationsList.find(
    (d) => d._id === currentPrimaryDesignationId
  );
  const primaryDesignationName = primaryDesignation?.name || "Unknown";

  // Filter out the primary designation (can't be additional)
  const availableDesignations = allDesignationsList.filter(
    (designation: Designation) =>
      designation._id !== currentPrimaryDesignationId
  );

  // Update selected designation IDs when modal opens or currentAdditionalDesignationIds changes
  useEffect(() => {
    if (isOpen) {
      setSelectedDesignationIds(currentAdditionalDesignationIds);
    }
  }, [isOpen, currentAdditionalDesignationIds]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await axiosInstance.put(`/employees/${employeeId}`, {
        additionalDesignationIds: selectedDesignationIds,
      });
      toast.success("Additional job titles updated successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to update additional job titles", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to update additional job titles";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const designationOptions = availableDesignations.map((designation) => ({
    label: designation.name,
    value: designation._id,
  }));

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
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                      <Dialog.Title className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        Manage Additional Job Titles
                      </Dialog.Title>
                      <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                        aria-label="Close"
                      >
                        <X size={22} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Employee:</span>{" "}
                            {employeeName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Assign additional job titles to this employee beyond
                            their primary job title. Employees can have multiple
                            job titles for different roles or responsibilities.
                          </p>
                        </div>

                        {currentPrimaryDesignationId && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-900 mb-2">
                              Primary Job Title:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                                {primaryDesignationName || "Loading..."}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700 mt-2">
                              This is the primary job title and cannot be
                              removed or added as additional.
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 block">
                            Additional Job Titles
                          </label>
                          {isLoadingDesignations ? (
                            <div className="text-sm text-gray-500 py-4">
                              Loading job titles...
                            </div>
                          ) : (
                            <MultiSelect
                              options={designationOptions}
                              value={selectedDesignationIds}
                              onChange={(selected: string[]) =>
                                setSelectedDesignationIds(selected)
                              }
                              placeholder="Select additional job titles (optional)"
                            />
                          )}
                          <p className="text-xs text-gray-500">
                            Select additional job titles to assign to this
                            employee. The primary job title is automatically
                            excluded from this list.
                          </p>
                        </div>

                        {selectedDesignationIds.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-green-900 mb-2">
                              Selected Additional Job Titles:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedDesignationIds.map((designationId) => {
                                const designation = allDesignationsList.find(
                                  (d) => d._id === designationId
                                );
                                return designation ? (
                                  <span
                                    key={designationId}
                                    className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-300"
                                  >
                                    {designation.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="px-6 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={loading || isLoadingDesignations}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-8 font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? "Saving..." : "Save Job Titles"}
                      </Button>
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
