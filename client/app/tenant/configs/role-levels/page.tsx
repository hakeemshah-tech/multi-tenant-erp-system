"use client";

import React, { useState, useEffect, Fragment } from "react";
import { Button, Input, Textarea, Title } from "rizzui";
import { Dialog, Transition } from "@headlessui/react";
import { Plus, Edit, Trash2, Save, X, Loader2, Layers } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface RoleLevel {
  _id: string;
  level: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function RoleLevelManagementPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("role-levels", "read");
  const canWrite = hasPermission("role-levels", "write");
  const canDelete = hasPermission("role-levels", "delete");
  const [roleLevels, setRoleLevels] = useState<RoleLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState<RoleLevel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formLevel, setFormLevel] = useState<number>(1);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Load role levels
  const loadRoleLevels = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/role-levels");
      setRoleLevels(response.data.data || []);
    } catch (error: any) {
      console.error("Error loading role levels:", error);
      toast.error(
        error.response?.data?.message || "Failed to load role levels"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoleLevels();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormLevel(1);
    setFormName("");
    setFormDescription("");
    setEditingLevel(null);
  };

  // Open add modal
  const handleAddClick = () => {
    if (!canWrite) return;
    resetForm();
    setShowAddModal(true);
  };

  // Open edit modal
  const handleEditClick = (level: RoleLevel) => {
    if (!canWrite) return;
    setEditingLevel(level);
    setFormLevel(level.level);
    setFormName(level.name);
    setFormDescription(level.description || "");
    setShowEditModal(true);
  };

  // Handle add
  const handleAdd = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to create role levels");
      return;
    }
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setIsSaving(true);
      await axiosInstance.post("/role-levels", {
        level: formLevel,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      toast.success("Role level created successfully");
      setShowAddModal(false);
      resetForm();
      loadRoleLevels();
    } catch (error: any) {
      console.error("Error creating role level:", error);
      toast.error(
        error.response?.data?.message || "Failed to create role level"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle update
  const handleUpdate = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to update role levels");
      return;
    }
    if (!formName.trim() || !editingLevel) {
      toast.error("Name is required");
      return;
    }

    try {
      setIsSaving(true);
      await axiosInstance.put(`/role-levels/${editingLevel._id}`, {
        level: formLevel,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      toast.success("Role level updated successfully");
      setShowEditModal(false);
      resetForm();
      loadRoleLevels();
    } catch (error: any) {
      console.error("Error updating role level:", error);
      toast.error(
        error.response?.data?.message || "Failed to update role level"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (level: RoleLevel) => {
    if (!canDelete) {
      toast.error("You don't have permission to delete role levels");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${level.name}"?`)) {
      return;
    }

    try {
      await axiosInstance.delete(`/role-levels/${level._id}`);
      toast.success("Role level deleted successfully");
      loadRoleLevels();
    } catch (error: any) {
      console.error("Error deleting role level:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete role level"
      );
    }
  };

  return (
    <PermissionGuard
      section="role-levels"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Title
                  as="h1"
                  className="text-2xl font-bold text-gray-900 flex items-center gap-2"
                >
                  <Layers className="w-6 h-6 text-blue-600" />
                  Role Level Management
                </Title>
                <p className="text-gray-600 mt-1">
                  Manage employee levels for your organization. These levels
                  determine data access permissions.
                </p>
              </div>
              <Button
                onClick={handleAddClick}
                className="flex items-center gap-2"
                color="primary"
                disabled={!canWrite}
              >
                <Plus className="w-4 h-4" />
                Add Level
              </Button>
            </div>
          </div>

          {/* Role Levels Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : roleLevels.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No role levels found. Click "Add Level" to create your first
                level.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {roleLevels.map((level) => (
                      <tr key={level._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-800 font-semibold">
                            {level.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {level.name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {level.description || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(level)}
                              className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Edit"
                              disabled={!canWrite}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(level)}
                              className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                              disabled={!canDelete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Modal */}
        <Transition show={showAddModal} as={Fragment}>
          <Dialog
            onClose={() => setShowAddModal(false)}
            className="relative z-50"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            </Transition.Child>

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-6">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      Add Role Level
                    </Dialog.Title>
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Level Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={formLevel}
                        onChange={(e) =>
                          setFormLevel(parseInt(e.target.value) || 1)
                        }
                        placeholder="Enter level number"
                        disabled={!canWrite}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Base Level - Worker"
                        disabled={!canWrite}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6">
                    <Button
                      onClick={() => setShowAddModal(false)}
                      variant="outline"
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAdd}
                      color="primary"
                      disabled={isSaving || !canWrite}
                      className="flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Create
                        </>
                      )}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* Edit Modal */}
        <Transition show={showEditModal} as={Fragment}>
          <Dialog
            onClose={() => setShowEditModal(false)}
            className="relative z-50"
          >
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            </Transition.Child>

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-6">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      Edit Role Level
                    </Dialog.Title>
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Level Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={formLevel}
                        onChange={(e) =>
                          setFormLevel(parseInt(e.target.value) || 1)
                        }
                        placeholder="Enter level number"
                        disabled={!canWrite}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Base Level - Worker"
                        disabled={!canWrite}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                        disabled={!canWrite}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6">
                    <Button
                      onClick={() => setShowEditModal(false)}
                      variant="outline"
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdate}
                      color="primary"
                      disabled={isSaving || !canWrite}
                      className="flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Update
                        </>
                      )}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      </div>
    </PermissionGuard>
  );
}
