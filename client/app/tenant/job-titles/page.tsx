"use client";

import { useEffect, useState } from "react";
import { Button, Table, Popover, Title, Text, Select } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import DesignationModalForm from "@/app/components/positions/DesignationModalForm";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface Designation {
  _id: string;
  name: string;
  isDeleted?: boolean;
  departmentIds: {
    _id: string;
    name: string;
    description?: string;
  }[];
  roleIds?: string[];
}

interface Role {
  roleId: string;
  name: string;
}

interface RoleLevel {
  _id: string;
  level: number;
  name: string;
  description?: string;
}

export default function DesignationListPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState<
    | {
        _id?: string;
        name: string;
        departmentIds: string[];
        roleIds?: string[];
        selectedDocumentFields: string[];
      }
    | undefined
  >(undefined);

  // Permission checks
  const { hasPermission, hasFullAccess } = usePermissions();
  const canRead = hasFullAccess || hasPermission("job-titles", "read");
  const canWrite = hasFullAccess || hasPermission("job-titles", "write");
  const canDelete = hasFullAccess || hasPermission("job-titles", "delete");

  const fetchDesignations = async () => {
    try {
      const res = await axiosInstance.get("/designations", {
        params: { page, limit: 10, search, status: statusFilter },
      });
      setDesignations(res.data.data);
      setTotalPages(Math.ceil((res.data.total || res.data.data.length) / 10));
    } catch (error) {
      console.error("Failed to fetch designations", error);
    }
  };

  const toggleDesignationStatus = async (id: string) => {
    try {
      const res = await axiosInstance.patch(
        `/designations/${id}/toggle-status`
      );
      toast.success(res.data.message);
      fetchDesignations();
    } catch (err: unknown) {
      console.error("Failed to toggle designation status", err);
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update job title status";
      toast.error(errorMessage);
    }
  };

  // Fetch roles for display
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axiosInstance.get("/roles");
        setRoles(res.data.data || []);
      } catch (error) {
        console.error("Failed to fetch roles", error);
      }
    };
    fetchRoles();
  }, []);

  // Reset page to 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchDesignations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  return (
    <PermissionGuard
      section="job-titles"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <DesignationModalForm
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDesignation(undefined);
        }}
        onSuccess={fetchDesignations}
        initialData={selectedDesignation}
        canEdit={canWrite}
      />

      <div className="space-y-6">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Field */}
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Search Job Title"
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
                onChange={(
                  option: {
                    label: string;
                    value: "active" | "inactive" | "all";
                  } | null
                ) => setStatusFilter(option?.value || "active")}
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
                Add Job Title
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Job Title</Table.Head>
                <Table.Head>Departments</Table.Head>
                <Table.Head>Roles</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body className="text-sm">
              {designations.length > 0 ? (
                designations.map((designation) => (
                  <Table.Row key={designation._id}>
                    <Table.Cell>
                      {canRead ? (
                        <button
                          onClick={() => {
                            // Transform designation for modal
                            setSelectedDesignation({
                              _id: designation._id,
                              name: designation.name,
                              departmentIds: designation.departmentIds.map(
                                (d: { _id: string }) => d._id
                              ),
                              roleIds: designation.roleIds || [],
                              selectedDocumentFields: [] as string[], // Will be populated by modal
                            });
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                        >
                          {designation.name}
                        </button>
                      ) : (
                        <span className="text-gray-900 font-medium">
                          {designation.name}
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-2">
                        {designation.departmentIds.length > 0 ? (
                          designation.departmentIds.map((dept) => (
                            <span
                              key={dept._id}
                              className="border border-blue-600 text-blue-600 text-xs px-2 py-1 rounded-full bg-blue-50"
                            >
                              {dept.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-2">
                        {designation.roleIds &&
                        designation.roleIds.length > 0 ? (
                          designation.roleIds.map((roleId) => {
                            const role = roles.find((r) => r.roleId === roleId);
                            return role ? (
                              <span
                                key={roleId}
                                className="border border-purple-600 text-purple-600 text-xs px-2 py-1 rounded-full bg-purple-50"
                              >
                                {role.name}
                              </span>
                            ) : (
                              <span
                                key={roleId}
                                className="border border-gray-400 text-gray-600 text-xs px-2 py-1 rounded-full bg-gray-50"
                              >
                                {roleId}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          designation.isDeleted
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {designation.isDeleted ? "Inactive" : "Active"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {canDelete ? (
                        designation.isDeleted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() =>
                              toggleDesignationStatus(designation._id)
                            }
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
                                  <Title as="h6">Make Job Title Inactive</Title>
                                  <Text>
                                    Are you sure you want to make this job title
                                    inactive?
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
                                        toggleDesignationStatus(
                                          designation._id
                                        );
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
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={6}>
                    <div className="text-center text-gray-500 py-6">
                      No job titles found.
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>

        {/* Pagination */}
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
