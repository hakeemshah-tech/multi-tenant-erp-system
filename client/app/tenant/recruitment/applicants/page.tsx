"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Table, Popover, Title, Text } from "rizzui";
import { TrashIcon } from "@heroicons/react/24/solid";
import { Loader2 } from "lucide-react";
import axiosInstance from "@/app/lib/axios";
import PageTopActions from "@/app/components/shared/PageTopActions";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { EmployeePhoto } from "@/app/components/shared/EmployeePhoto";

interface Designation {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  designation?: Designation;
  employeeFields: {
    personaldetails?: {
      firstname?: string;
      middlename?: string;
      lastname?: string;
      mobile?: string;
      employeephoto?: string;
    };
    employeedetails?: {
      employmentstatus?: string;
    };
    userId?: {
      email?: string;
    };
  };
  employeeProfile?: {
    userId?: {
      email?: string;
    };
    personaldetails?: {
      employeephoto?: {
        url?: string;
      };
    };
  };
}

export default function ApplicantEmployeeListPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/employees", {
        params: { page, limit, search, employmentStatus: "applicant" },
      });
      const employees = res.data.data || [];
      const pagination = res.data.pagination || {};

      setEmployees(employees);
      setTotal(pagination.total || employees.length);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await axiosInstance.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (err) {
      console.error("Failed to delete employee", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, search]);

  return (
    <div className="space-y-6">
      <PageTopActions
        search={search}
        onSearchChange={setSearch}
        onAddClick={() => router.push("/tenant/employees/add")}
        onFilterClick={() => console.log("Filter clicked")}
        addLabel="Add Applicant"
        placeholder="Search Applicant"
      />

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Photo</Table.Head>
              <Table.Head>Name</Table.Head>
              <Table.Head>ID</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              <Table.Head>Job Title</Table.Head>
              <Table.Head>Employment Status</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body className="text-sm">
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
                    <p className="text-gray-600 text-sm">
                      Loading applicants...
                    </p>
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : employees.length > 0 ? (
              employees.map((emp) => {
                const pd =
                  emp.employeeFields?.personaldetails ||
                  emp.employeeProfile?.personaldetails;
                const email = emp.employeeProfile?.userId?.email || "—";
                const fullName = `${pd?.firstname || ""} ${
                  pd?.middlename || ""
                } ${pd?.lastname || ""}`.trim();
                const employmentStatus =
                  getProfileOrAdditionalValue(
                    emp,
                    "employeedetails",
                    "employmentstatus"
                  ) || "—";

                return (
                  <Table.Row key={emp._id}>
                    <Table.Cell>
                      <EmployeePhoto employee={emp} size={40} />
                    </Table.Cell>
                    <Table.Cell>
                      {fullName ? (
                        <button
                          onClick={() =>
                            router.push(
                              `/tenant/recruitment/applicants/${emp._id}`
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition-colors"
                        >
                          {fullName}
                        </button>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-[11px] text-gray-500">
                        {emp._id}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{email}</Table.Cell>
                    <Table.Cell>{pd?.mobile || "—"}</Table.Cell>
                    <Table.Cell>{emp.designation?.name || "—"}</Table.Cell>
                    <Table.Cell>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {employmentStatus}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Popover>
                        <Popover.Trigger>
                          <Button size="sm" variant="outline" color="danger">
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </Popover.Trigger>
                        <Popover.Content>
                          {({ setOpen }) => (
                            <div className="w-56">
                              <Title as="h6">Delete Employee</Title>
                              <Text>
                                Are you sure you want to delete this employee?
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
                                  color="danger"
                                  onClick={() => {
                                    deleteEmployee(emp._id);
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
                    </Table.Cell>
                  </Table.Row>
                );
              })
            ) : (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="flex flex-col items-center justify-center text-center py-10">
                    <p className="text-gray-600 text-sm font-medium">
                      No employees found
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Try adjusting your search or add a new employee.
                    </p>
                  </div>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>

      {Math.ceil(total / limit) > 1 &&
        (() => {
          const totalPages = Math.ceil(total / limit);
          const getPageNumbers = () => {
            const pages: (number | string)[] = [];
            const maxVisible = 7; // Maximum visible page numbers
            const sideCount = 2; // Pages to show on each side of current page

            if (totalPages <= maxVisible) {
              // Show all pages if total is less than max visible
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              // Always show first page
              pages.push(1);

              // Calculate start and end of middle section
              let start = Math.max(2, page - sideCount);
              let end = Math.min(totalPages - 1, page + sideCount);

              // Adjust if we're near the start
              if (page <= sideCount + 2) {
                end = Math.min(maxVisible - 1, totalPages - 1);
              }

              // Adjust if we're near the end
              if (page >= totalPages - sideCount - 1) {
                start = Math.max(2, totalPages - (maxVisible - 2));
              }

              // Add ellipsis after first page if needed
              if (start > 2) {
                pages.push("ellipsis-start");
              }

              // Add middle pages
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }

              // Add ellipsis before last page if needed
              if (end < totalPages - 1) {
                pages.push("ellipsis-end");
              }

              // Always show last page
              if (totalPages > 1) {
                pages.push(totalPages);
              }
            }

            return pages;
          };

          const pageNumbers = getPageNumbers();

          return (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="px-4"
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((item, index) => {
                  if (item === "ellipsis-start" || item === "ellipsis-end") {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 text-gray-500"
                      >
                        ...
                      </span>
                    );
                  }

                  const pageNum = item as number;
                  const isActive = pageNum === page;

                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={isActive ? "solid" : "outline"}
                      onClick={() => setPage(pageNum)}
                      className={`min-w-[40px] ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page === totalPages}
                className="px-4"
              >
                Next
              </Button>

              <div className="ml-4 text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
