"use client";

import { useEffect, useState } from "react";
import { Button, Table, Popover, Title, Text, Select } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import DepartmentModalForm from "@/app/components/departments/DepartmentModalForm";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface Department {
  _id: string;
  name: string;
  description?: string;
  isDeleted?: boolean;
}

export default function DepartmentListPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Department | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Permission checks
  const { hasPermission, hasFullAccess } = usePermissions();
  const canRead = hasFullAccess || hasPermission("departments", "read");
  const canWrite = hasFullAccess || hasPermission("departments", "write");
  const canDelete = hasFullAccess || hasPermission("departments", "delete");

  const fetchDepartments = async () => {
    try {
      const res = await axiosInstance.get("/departments", {
        params: { page, limit: 10, search, status: statusFilter },
      });
      setDepartments(res.data.data);
      setTotalPages(Math.ceil((res.data.total || res.data.data.length) / 10));
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  };

  const toggleDepartmentStatus = async (id: string) => {
    try {
      const res = await axiosInstance.patch(`/departments/${id}/toggle-status`);
      toast.success(res.data.message);
      fetchDepartments();
    } catch (err: any) {
      console.error("Failed to toggle department status", err);
      const errorMessage =
        err?.response?.data?.message || "Failed to update department status";
      toast.error(errorMessage);
    }
  };

  // Reset page to 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [page, search, statusFilter]);

  return (
    <PermissionGuard
      section="departments"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6">
        <DepartmentModalForm
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelected(null);
          }}
          onSuccess={fetchDepartments}
          initialData={selected || undefined}
          canEdit={canWrite}
        />

        <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Field */}
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Search Department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full shadow-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm transition-all"
            />
          </div>

          {/* Action Buttons and Status Filter */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-end items-stretch sm:items-center">
            {/* Status Filter - Modern Design */}
            <div className="w-full sm:w-auto">
              <Select
                value={{
                  label:
                    statusFilter === "active"
                      ? "Active"
                      : statusFilter === "inactive"
                        ? "Inactive"
                        : "All",
                  value: statusFilter,
                }}
                onChange={(option: any) =>
                  setStatusFilter(option?.value || "active")
                }
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                  { label: "All", value: "all" },
                ]}
                className="w-full sm:w-44"
              />
            </div>

            {canWrite && (
              <Button
                className="rounded-full bg-blue-600 text-white px-6 py-2.5 text-sm hover:bg-blue-700 transition-colors shadow-md font-medium"
                onClick={() => setIsModalOpen(true)}
              >
                Add Department
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Description</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body className="text-sm">
              {departments.length > 0 ? (
                departments.map((dept) => (
                  <Table.Row key={dept._id}>
                    <Table.Cell>
                      {canRead ? (
                        <button
                          onClick={() => {
                            setSelected(dept);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                        >
                          {dept.name}
                        </button>
                      ) : (
                        <span className="text-gray-900 font-medium">
                          {dept.name}
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{dept.description || "—"}</Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          dept.isDeleted
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {dept.isDeleted ? "Inactive" : "Active"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {canDelete ? (
                        dept.isDeleted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() => toggleDepartmentStatus(dept._id)}
                          >
                            Make it Active
                          </Button>
                        ) : (
                          <Popover>
                            <Popover.Trigger>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-600 text-red-600 hover:bg-red-50"
                              >
                                Make it Inactive
                              </Button>
                            </Popover.Trigger>
                            <Popover.Content>
                              {({ setOpen }) => (
                                <div className="w-56">
                                  <Title as="h6">
                                    Make Department Inactive
                                  </Title>
                                  <Text>
                                    Are you sure you want to make this
                                    department inactive?
                                  </Text>
                                  <div className="flex justify-end gap-3 mt-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setOpen(false)}
                                    >
                                      No
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() => {
                                        toggleDepartmentStatus(dept._id);
                                        setOpen(false);
                                      }}
                                    >
                                      Yes
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Popover.Content>
                          </Popover>
                        )
                      ) : (
                        <span className="text-gray-400 text-sm">
                          No actions
                        </span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <div className="text-center text-gray-500 py-6">
                      No departments found.
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="rounded-full"
            >
              &lt; Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <Button
                key={num}
                size="sm"
                variant={num === page ? "solid" : "outline"}
                className={`rounded-full px-4 ${
                  num === page ? "bg-blue-700 text-white" : ""
                }`}
                onClick={() => setPage(num)}
              >
                {num}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="rounded-full"
            >
              Next &gt;
            </Button>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
