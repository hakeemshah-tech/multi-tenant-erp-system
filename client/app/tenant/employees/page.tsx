// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { Button, Table } from "rizzui";
// import axiosInstance from "@/app/lib/axios";
// import PageTopActions from "@/app/components/shared/PageTopActions";

// interface FieldValue {
//   key: string;
//   value: any;
// }

// interface SectionData {
//   sectionKey: string;
//   fields: FieldValue[];
// }

// interface Employee {
//   _id: string;
//   designationId?: {
//     _id: string;
//     name: string;
//   };
//   sections: SectionData[];
// }

// interface Employee {
//   _id: string;
//   designationId?: {
//     _id: string;
//     name: string;
//   };
//   data: Record<string, any>;
// }

// const getFieldValue = (sections: SectionData[], fieldKey: string) => {
//   for (const section of sections) {
//     const match = section.fields.find((f) => f.key === fieldKey);
//     if (match) return match.value;
//   }
//   return "—";
// };

// export default function EmployeeListPage() {
//   const router = useRouter();

//   const [search, setSearch] = useState("");
//   const [page, setPage] = useState(1);
//   const [limit] = useState(20);
//   const [total, setTotal] = useState(0);
//   const [employees, setEmployees] = useState<Employee[]>([]);

//   const fetchEmployees = async () => {
//     try {
//       const res = await axiosInstance.get("/employees", {
//         params: { page, limit, search },
//       });
//       setEmployees(res.data.data);
//       setTotal(res.data.total);
//     } catch (err) {
//       console.error("Failed to fetch employees", err);
//     }
//   };

//   useEffect(() => {
//     fetchEmployees();
//   }, [page, search]);

//   return (
//     <div className="space-y-6">
//       <PageTopActions
//         search={search}
//         onSearchChange={setSearch}
//         onAddClick={() => router.push("/tenant/employees/add")}
//         onFilterClick={() => console.log("Filter clicked")}
//         addLabel="Add Employee"
//         placeholder="Search Employee"
//       />

//       <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 overflow-x-auto">
//         <Table>
//           <Table.Header>
//             <Table.Row>
//               <Table.Head>Name</Table.Head>
//               <Table.Head>Email</Table.Head>
//               <Table.Head>Phone</Table.Head>
//               <Table.Head>Designation</Table.Head>
//               <Table.Head>Actions</Table.Head>
//             </Table.Row>
//           </Table.Header>
//           <Table.Body className="text-sm">
//             {employees.map((emp) => {
//               const firstname = getFieldValue(emp.sections, "employeename");
//               const middlename = getFieldValue(emp.sections, "middlename");
//               const lastname = getFieldValue(emp.sections, "lastname");
//               const email = getFieldValue(emp.sections, "email");
//               const mobile = getFieldValue(emp.sections, "mobile");
//               const designation = getFieldValue(emp.sections, "designation");

//               return (
//                 <Table.Row key={emp._id}>
//                   <Table.Cell>
//                     {`${firstname} ${middlename || ""} ${lastname}`.trim() ||
//                       "—"}
//                   </Table.Cell>
//                   <Table.Cell>{email}</Table.Cell>
//                   <Table.Cell>{mobile}</Table.Cell>
//                   <Table.Cell>{designation}</Table.Cell>
//                   <Table.Cell>
//                     <div className="flex gap-2 flex-wrap">
//                       <Button
//                         size="sm"
//                         variant="outline"
//                         onClick={() =>
//                           router.push(`/tenant/employees/${emp._id}`)
//                         }
//                       >
//                         View
//                       </Button>
//                       <Button
//                         size="sm"
//                         onClick={() =>
//                           router.push(`/tenant/employees/${emp._id}/edit`)
//                         }
//                       >
//                         Edit
//                       </Button>
//                       <Button
//                         size="sm"
//                         variant="outline"
//                         color="danger"
//                         onClick={() => console.log("Delete", emp._id)}
//                       >
//                         Delete
//                       </Button>
//                     </div>
//                   </Table.Cell>
//                 </Table.Row>
//               );
//             })}
//           </Table.Body>
//         </Table>
//       </div>

//       {/* Pagination */}
//       {Math.ceil(total / limit) > 1 && (
//         <div className="flex justify-center items-center gap-1 mt-6">
//           <Button
//             size="sm"
//             variant="outline"
//             onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
//             disabled={page === 1}
//             className="rounded-full"
//           >
//             &lt; Previous
//           </Button>
//           {Array.from(
//             { length: Math.ceil(total / limit) },
//             (_, i) => i + 1
//           ).map((num) => (
//             <Button
//               key={num}
//               size="sm"
//               variant={num === page ? "solid" : "outline"}
//               className={`rounded-full px-4 ${
//                 num === page ? "bg-blue-700 text-white" : ""
//               }`}
//               onClick={() => setPage(num)}
//             >
//               {num}
//             </Button>
//           ))}
//           <Button
//             size="sm"
//             variant="outline"
//             onClick={() =>
//               setPage((prev) => Math.min(prev + 1, Math.ceil(total / limit)))
//             }
//             disabled={page === Math.ceil(total / limit)}
//             className="rounded-full"
//           >
//             Next &gt;
//           </Button>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Table, Popover, Title, Text } from "rizzui";
import { TrashIcon } from "@heroicons/react/24/solid";
import { Loader2, Shield, Briefcase } from "lucide-react";
import axiosInstance from "@/app/lib/axios";
import PageTopActions from "@/app/components/shared/PageTopActions";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { EmployeePhoto } from "@/app/components/shared/EmployeePhoto";
import AdditionalRolesModal from "@/app/components/employees/AdditionalRolesModal";
import AdditionalJobTitlesModal from "@/app/components/employees/AdditionalJobTitlesModal";
import { usePermissions } from "@/app/hooks/usePermissions";

interface Designation {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  designation?: Designation;
  additionalRoleIds?: string[];
  additionalDesignationIds?: Designation[];
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

export default function EmployeeListPage() {
  const router = useRouter();
  const { hasPermission, hasFullAccess } = usePermissions();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [jobTitlesModalOpen, setJobTitlesModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [roles, setRoles] = useState<{ roleId: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [designationRoleIdsCache, setDesignationRoleIdsCache] = useState<{
    [designationId: string]: string[];
  }>({});
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingDesignations, setLoadingDesignations] = useState(true);

  // Permission checks for component-level access control
  const canWriteEmployees =
    hasFullAccess || hasPermission("employees", "write");
  const canDeleteEmployees =
    hasFullAccess || hasPermission("employees", "delete");

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/employees", {
        params: { page, limit, search },
      });
      // Filter only employees with employmentStatus === "Onboard"
      const allEmployees = res.data.data || [];
      const onboardEmployees = allEmployees.filter((emp: Employee) => {
        const employmentStatus = getProfileOrAdditionalValue(
          emp,
          "employeedetails",
          "employmentstatus"
        );
        return employmentStatus === "Onboard";
      });
      setEmployees(onboardEmployees);
      const pagination = res.data.pagination || {};
      setTotal(pagination.total || onboardEmployees.length);
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

  // Fetch roles and designations once on page load (cached)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch roles
        setLoadingRoles(true);
        const rolesRes = await axiosInstance.get("/roles");
        setRoles(rolesRes.data.data || []);
        setLoadingRoles(false);
      } catch (error) {
        console.error("Failed to fetch roles", error);
        setLoadingRoles(false);
      }

      try {
        // Fetch designations
        setLoadingDesignations(true);
        const designationsRes = await axiosInstance.get("/designations", {
          params: { status: "active", limit: 1000 },
        });
        const fetchedDesignations = designationsRes.data.data || [];
        setDesignations(fetchedDesignations);

        // Don't pre-fetch all roleIds - we'll fetch them lazily when needed
        // This avoids making too many API calls upfront if there are many designations
        setLoadingDesignations(false);
      } catch (error) {
        console.error("Failed to fetch designations", error);
        setLoadingDesignations(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, search]);

  const handleOpenRolesModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setRolesModalOpen(true);
  };

  const handleCloseRolesModal = () => {
    setRolesModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleOpenJobTitlesModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setJobTitlesModalOpen(true);
  };

  const handleCloseJobTitlesModal = () => {
    setJobTitlesModalOpen(false);
    setSelectedEmployee(null);
  };

  return (
    <div className="space-y-6">
      {selectedEmployee && (
        <>
          <AdditionalRolesModal
            isOpen={rolesModalOpen}
            onClose={handleCloseRolesModal}
            employeeId={selectedEmployee._id}
            employeeName={
              `${selectedEmployee.employeeFields?.personaldetails?.firstname || ""} ${
                selectedEmployee.employeeFields?.personaldetails?.middlename ||
                ""
              } ${selectedEmployee.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
              "Employee"
            }
            currentAdditionalRoleIds={selectedEmployee.additionalRoleIds || []}
            jobTitleRoleIds={[]} // Will be fetched in modal if needed
            designationRoleIdsCache={designationRoleIdsCache}
            setDesignationRoleIdsCache={setDesignationRoleIdsCache}
            allRoles={roles}
            isLoadingRoles={loadingRoles}
            onSuccess={() => {
              fetchEmployees();
            }}
          />
          <AdditionalJobTitlesModal
            isOpen={jobTitlesModalOpen}
            onClose={handleCloseJobTitlesModal}
            employeeId={selectedEmployee._id}
            employeeName={
              `${selectedEmployee.employeeFields?.personaldetails?.firstname || ""} ${
                selectedEmployee.employeeFields?.personaldetails?.middlename ||
                ""
              } ${selectedEmployee.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
              "Employee"
            }
            currentPrimaryDesignationId={selectedEmployee.designation?._id}
            currentAdditionalDesignationIds={
              selectedEmployee.additionalDesignationIds?.map((d) => d._id) || []
            }
            allDesignations={designations}
            isLoadingDesignations={loadingDesignations}
            onSuccess={() => {
              fetchEmployees();
            }}
          />
        </>
      )}
      <PageTopActions
        search={search}
        onSearchChange={setSearch}
        onAddClick={() => router.push("/tenant/employees/add")}
        onFilterClick={() => console.log("Filter clicked")}
        addLabel="Add Employee"
        placeholder="Search Employee"
        // Hide "Add Employee" button if user doesn't have write permission
        hideAddButton={!canWriteEmployees}
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
          {/* <Table.Body className="text-sm">
            {employees.map((emp) => {
              const pd = emp.employeeProfile?.personaldetails || {};
              const email = emp.employeeProfile?.userId?.email || "—";
              const fullName = `${pd.firstname || ""} ${pd.middlename || ""} ${
                pd.lastname || ""
              }`.trim();
              const photo = pd.employeephoto?.url;

              return (
                <Table.Row key={emp._id}>
                  <Table.Cell>
                    {photo ? (
                      <Image
                        src={photo}
                        alt="Employee"
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 text-[6px] flex items-center justify-center text-gray-500">
                        No Img
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell>{fullName || "—"}</Table.Cell>
                  <Table.Cell>{email}</Table.Cell>
                  <Table.Cell>{pd.mobile || "—"}</Table.Cell>
                  <Table.Cell>{emp.designation?.name || "—"}</Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/tenant/employees/${emp._id}`)
                        }
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/tenant/employees/${emp._id}/edit`)
                        }
                      >
                        Edit
                      </Button>
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
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body> */}
          <Table.Body className="text-sm">
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
                    <p className="text-gray-600 text-sm">
                      Loading employees...
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
                            router.push(`/tenant/employees/${emp._id}`)
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRolesModal(emp)}
                          className="border-purple-600 text-purple-600 hover:bg-purple-50"
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          Roles
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenJobTitlesModal(emp)}
                          className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                          <Briefcase className="w-4 h-4 mr-1" />
                          Job Titles
                        </Button>
                        {/* Only show delete button if user has delete permission */}
                        {canDeleteEmployees && (
                          <Popover>
                            <Popover.Trigger>
                              <Button
                                size="sm"
                                variant="outline"
                                color="danger"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </Button>
                            </Popover.Trigger>
                            <Popover.Content>
                              {({ setOpen }) => (
                                <div className="w-56">
                                  <Title as="h6">Delete Employee</Title>
                                  <Text>
                                    Are you sure you want to delete this
                                    employee?
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
                        )}
                      </div>
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
