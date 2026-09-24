"use client";

import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, MultiSelect } from "rizzui";
import { X, Shield } from "lucide-react";
import { toast } from "react-toastify";
import axiosInstance from "@/app/lib/axios";

interface Role {
  roleId: string;
  name: string;
  color?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  currentAdditionalRoleIds?: string[];
  jobTitleRoleIds?: string[]; // Roles from job title (may be empty, will fetch if needed)
  allRoles?: Role[]; // Pre-fetched roles to avoid API calls
  isLoadingRoles?: boolean; // Loading state from parent
  designationRoleIdsCache?: { [designationId: string]: string[] };
  setDesignationRoleIdsCache?: React.Dispatch<
    React.SetStateAction<{ [designationId: string]: string[] }>
  >;
  onSuccess: () => void;
}

export default function AdditionalRolesModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentAdditionalRoleIds = [],
  jobTitleRoleIds = [],
  allRoles = [],
  isLoadingRoles = false,
  designationRoleIdsCache = {},
  setDesignationRoleIdsCache,
  onSuccess,
}: Props) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    currentAdditionalRoleIds
  );
  const [loading, setLoading] = useState(false);
  const [actualJobTitleRoleIds, setActualJobTitleRoleIds] = useState<string[]>(
    jobTitleRoleIds || []
  );
  const [fetchingJobTitleRoles, setFetchingJobTitleRoles] = useState(false);

  // Use provided roles or empty array
  const allRolesList = allRoles || [];

  // Fetch job title roleIds if not provided (lazy loading)
  useEffect(() => {
    const fetchJobTitleRoleIds = async () => {
      if (jobTitleRoleIds && jobTitleRoleIds.length > 0) {
        // Already provided, use them
        setActualJobTitleRoleIds(jobTitleRoleIds);
        return;
      }

      // Need to fetch - check if we have employee's designation
      try {
        setFetchingJobTitleRoles(true);
        const employeeRes = await axiosInstance.get(`/employees/${employeeId}`);
        const designationId = employeeRes.data.data?.designation?._id;

        if (designationId) {
          // Check cache first
          if (
            designationRoleIdsCache &&
            designationRoleIdsCache[designationId]
          ) {
            setActualJobTitleRoleIds(designationRoleIdsCache[designationId]);
            setFetchingJobTitleRoles(false);
            return;
          }

          // Fetch from API
          const designationRes = await axiosInstance.get(
            `/designations/${designationId}`
          );
          const fetchedRoleIds = designationRes.data.data?.roleIds || [];
          setActualJobTitleRoleIds(fetchedRoleIds);

          // Update cache
          if (setDesignationRoleIdsCache) {
            setDesignationRoleIdsCache((prev) => ({
              ...prev,
              [designationId]: fetchedRoleIds,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch job title roleIds", error);
      } finally {
        setFetchingJobTitleRoles(false);
      }
    };

    if (isOpen && !jobTitleRoleIds?.length) {
      fetchJobTitleRoleIds();
    } else if (jobTitleRoleIds?.length) {
      setActualJobTitleRoleIds(jobTitleRoleIds);
    }
  }, [
    isOpen,
    employeeId,
    jobTitleRoleIds,
    designationRoleIdsCache,
    setDesignationRoleIdsCache,
  ]);

  // Filter out system_admin and roles already assigned via job title
  const availableRoles = allRolesList.filter(
    (role: Role) =>
      role.roleId !== "system_admin" &&
      !actualJobTitleRoleIds.includes(role.roleId)
  );

  // Update selected role IDs when modal opens or currentAdditionalRoleIds changes
  useEffect(() => {
    if (isOpen) {
      setSelectedRoleIds(currentAdditionalRoleIds);
    }
  }, [isOpen, currentAdditionalRoleIds]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await axiosInstance.put(`/employees/${employeeId}`, {
        additionalRoleIds: selectedRoleIds,
      });
      toast.success("Additional roles updated successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to update additional roles", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update additional roles";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = availableRoles.map((role) => ({
    label: role.name,
    value: role.roleId,
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
                        <Shield className="w-5 h-5 text-purple-600" />
                        Manage Additional Roles
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
                            Assign additional roles to this employee beyond
                            their job title roles. These roles will be added to
                            the roles inherited from their job title.
                          </p>
                        </div>

                        {actualJobTitleRoleIds.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-blue-900 mb-2">
                              Roles from Job Title:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {actualJobTitleRoleIds.map((roleId) => {
                                const role = allRolesList.find(
                                  (r) => r.roleId === roleId
                                );
                                return role ? (
                                  <span
                                    key={roleId}
                                    className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-300"
                                  >
                                    {role.name}
                                  </span>
                                ) : (
                                  <span
                                    key={roleId}
                                    className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-300"
                                  >
                                    {roleId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 block">
                            Additional Roles
                          </label>
                          {isLoadingRoles ? (
                            <div className="text-sm text-gray-500 py-4">
                              Loading roles...
                            </div>
                          ) : (
                            <MultiSelect
                              options={roleOptions}
                              value={selectedRoleIds}
                              onChange={(selected: string[]) =>
                                setSelectedRoleIds(selected)
                              }
                              placeholder="Select additional roles (optional)"
                            />
                          )}
                          <p className="text-xs text-gray-500">
                            Select roles to assign in addition to job title
                            roles. System Admin role is not available as it has
                            full access by default.
                          </p>
                        </div>

                        {selectedRoleIds.length > 0 && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-purple-900 mb-2">
                              Selected Additional Roles:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {selectedRoleIds.map((roleId) => {
                                const role = allRolesList.find(
                                  (r) => r.roleId === roleId
                                );
                                return role ? (
                                  <span
                                    key={roleId}
                                    className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-300"
                                  >
                                    {role.name}
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
                        disabled={loading || isLoadingRoles}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-8 font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? "Saving..." : "Save Roles"}
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
