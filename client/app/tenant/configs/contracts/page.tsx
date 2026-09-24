"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { Button, Input, Select, Table, MultiSelect } from "rizzui";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { contractTemplatesService } from "@/app/services/contractTemplates.service";
import axios from "@/app/lib/axios";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

type Option = { label: string; value: string };

type ContractType = { _id: string; title: string };
type Designation = { _id: string; name: string };

type ContractTemplate = {
  _id: string;
  title: string;
  description?: string;
  contractTypeIds?: any;
  employmentTypes?: any;
  designationIds?: any;
  createdAt: string;
};

export default function ConfigContractsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("contracts", "read");
  const canWrite = hasPermission("contracts", "write");
  const canDelete = hasPermission("contracts", "delete");

  const [contractTypes, setContractTypes] = useState<Option[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);

  const [selectedContractType, setSelectedContractType] = useState<string>("");
  const [selectedEmploymentType, setSelectedEmploymentType] =
    useState<string>("");
  const [selectedDesignation, setSelectedDesignation] = useState<string>("");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  // Normalize selected values (Select may return either raw value or {label,value})
  const selectedContractTypeId = useMemo(
    () => (selectedContractType as any)?.value ?? selectedContractType,
    [selectedContractType]
  );
  const selectedContractTypeLabel = useMemo(
    () => contractTypes.find((c) => c.value === selectedContractTypeId)?.label,
    [contractTypes, selectedContractTypeId]
  );

  const selectedDesignationId = useMemo(
    () => (selectedDesignation as any)?.value ?? selectedDesignation,
    [selectedDesignation]
  );

  // Create modal state (selections for new template flow)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalContractTypeIds, setModalContractTypeIds] = useState<string[]>(
    []
  );
  const [modalEmploymentTypes, setModalEmploymentTypes] = useState<string[]>(
    []
  );
  const [modalDesignationIds, setModalDesignationIds] = useState<string[]>([]);

  const isEmploymentSelected = useMemo(() => {
    const selected = contractTypes.filter((c) =>
      modalContractTypeIds.includes(c.value)
    );
    return selected.some((c) => (c.label || "").toLowerCase() === "employment");
  }, [contractTypes, modalContractTypeIds]);
  // using array of ids for modal selections

  const loadBasics = async () => {
    const [ctRes] = await Promise.all([axios.get("/contract-types")]);
    const ctOptions: Option[] = (ctRes.data.data as ContractType[]).map(
      (x) => ({ label: x.title, value: x._id })
    );
    setContractTypes(ctOptions);
  };

  const loadEmploymentTypes = async () => {
    const { data } = await axios.get("/employee-field-config/employment-types");
    setEmploymentTypes(
      (data.data as string[]).map((s) => ({ label: s, value: s }))
    );
  };

  const loadDesignations = async () => {
    const { data } = await axios.get("/designations", {
      params: { limit: 1000 },
    });
    const opts = (data.data as Designation[]).map((d) => ({
      label: d.name,
      value: d._id,
    }));
    setDesignations(opts);
  };

  const loadTemplates = async () => {
    const params: any = { search };
    if (selectedContractTypeId) params.contractTypeId = selectedContractTypeId;
    if (selectedEmploymentType) params.employmentType = selectedEmploymentType;
    if (selectedDesignationId) params.designationId = selectedDesignationId;
    const { data } = await axios.get("/contract-templates", { params });
    setTemplates(data.data);
  };

  useEffect(() => {
    loadBasics();
    loadEmploymentTypes();
    loadDesignations();
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [
    selectedContractType,
    selectedEmploymentType,
    selectedDesignation,
    search,
  ]);

  const openCreateModal = () => {
    // Seed modal defaults from current filters for convenience
    setModalContractTypeIds(
      selectedContractTypeId ? [String(selectedContractTypeId)] : []
    );
    setModalEmploymentTypes(
      selectedEmploymentType ? [String(selectedEmploymentType)] : []
    );
    setModalDesignationIds(
      selectedDesignationId ? [String(selectedDesignationId)] : []
    );
    setShowCreateModal(true);
  };

  const confirmCreate = async () => {
    if (!modalContractTypeIds || modalContractTypeIds.length === 0) {
      toast.error("Please select at least one Contract Type");
      return;
    }
    if (!modalDesignationIds || modalDesignationIds.length === 0) {
      toast.error("Please select at least one Job Title");
      return;
    }

    // Check if any selected contract type is "employment"
    const isEmployment = modalContractTypeIds.some((ctId) => {
      const ct = contractTypes.find((c) => c.value === ctId);
      return (ct?.label || "").toLowerCase() === "employment";
    });

    // If employment types are selected, validate they exist
    if (
      isEmployment &&
      (!modalEmploymentTypes || modalEmploymentTypes.length === 0)
    ) {
      toast.error("Please select at least one Employment Type");
      return;
    }

    try {
      // Create template in database immediately with minimal data
      const payload: any = {
        title: "New Contract Template", // Default title, user can change it
        description: "",
        contractTypeIds: modalContractTypeIds,
        designationIds: modalDesignationIds,
      };

      if (modalEmploymentTypes.length > 0) {
        payload.employmentTypes = modalEmploymentTypes;
      }

      const created = await contractTemplatesService.create(payload);
      const templateId = created._id;

      // Navigate to template form with templateId in URL
      // The template form will load this template and pre-fill all fields
      const qs = new URLSearchParams({
        templateId: templateId,
        contractTypeIds: modalContractTypeIds.join(","),
        employmentTypes:
          modalEmploymentTypes.length > 0 ? modalEmploymentTypes.join(",") : "",
        designationIds: modalDesignationIds.join(","),
      });

      setShowCreateModal(false);
      router.push(`/tenant/contracts/templates/new?${qs.toString()}`);
      toast.success("Template created");
    } catch (e: any) {
      console.error("Failed to create template", e);
      const errorMessage =
        e?.response?.data?.message || "Failed to create template";
      toast.error(errorMessage);
    }
  };

  return (
    <PermissionGuard
      section="contracts"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Contracts</h1>
          {canWrite && (
            <Button onClick={openCreateModal}>New Contract Template</Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border">
          <Select
            label="Contract Type"
            value={selectedContractType}
            onChange={(v: any) => {
              setSelectedContractType(v);
              setSelectedEmploymentType("");
            }}
            options={contractTypes}
            placeholder="Select"
          />
          {(selectedContractTypeLabel || "").toLowerCase() === "employment" && (
            <Select
              label="Employment Type"
              value={selectedEmploymentType}
              onChange={(v: any) =>
                setSelectedEmploymentType((v as any)?.value ?? v)
              }
              options={employmentTypes}
              placeholder="Select"
            />
          )}
          {(selectedContractTypeLabel || "").toLowerCase() === "employment" &&
            selectedEmploymentType && (
              <Select
                label="Job Title"
                value={selectedDesignation}
                onChange={(v: any) => setSelectedDesignation(v)}
                options={designations}
                placeholder="Select"
              />
            )}
          <Input
            label="Search"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            placeholder="Search templates"
          />
        </div>

        <div className="bg-white rounded-xl border p-4 overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Title</Table.Head>
                <Table.Head>Contract Type</Table.Head>
                <Table.Head>Employment Type</Table.Head>
                <Table.Head>Job Title</Table.Head>
                <Table.Head>Created</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body className="text-sm">
              {templates.map((t) => {
                const ct = (() => {
                  const ids: any = (t as any).contractTypeIds;
                  if (Array.isArray(ids) && ids.length > 0) {
                    const labels = ids
                      .map((x: any) => {
                        if (x && typeof x === "object") return x.title;
                        const found = contractTypes.find(
                          (opt) => opt.value === x
                        );
                        return found?.label || "";
                      })
                      .filter(Boolean);
                    return labels.length ? labels.join(", ") : "-";
                  }
                  return "-";
                })();
                const d = (() => {
                  const ids: any = (t as any).designationIds;
                  if (Array.isArray(ids) && ids.length > 0) {
                    const labels = ids
                      .map((x: any) => {
                        if (x && typeof x === "object") return x.name;
                        const found = designations.find(
                          (opt) => opt.value === x
                        );
                        return found?.label || "";
                      })
                      .filter(Boolean);
                    return labels.length ? labels.join(", ") : "-";
                  }
                  return "-";
                })();
                const empType = (() => {
                  const ets: any = (t as any).employmentTypes;
                  if (Array.isArray(ets) && ets.length > 0) {
                    return ets.join(", ");
                  }
                  return "-";
                })();
                return (
                  <Table.Row key={t._id}>
                    <Table.Cell className="font-medium">{t.title}</Table.Cell>
                    <Table.Cell>{ct}</Table.Cell>
                    <Table.Cell>{empType}</Table.Cell>
                    <Table.Cell>{d}</Table.Cell>
                    <Table.Cell className="flex items-center gap-2">
                      {new Date(t.createdAt).toLocaleString()}
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            router.push(
                              `/tenant/contracts/templates/${t._id}/edit`
                            );
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!confirm("Delete this template?")) return;
                            try {
                              await contractTemplatesService.remove(t._id);
                              loadTemplates();
                              toast.success("Template deleted successfully");
                            } catch (e: any) {
                              console.error("Failed to delete template", e);
                              toast.error(
                                e?.response?.data?.message ||
                                  "Failed to delete template"
                              );
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>

        {/* Create New Contract Template Modal */}
        <Modal
          visible={showCreateModal}
          title="Create New Contract Template"
          onClose={() => setShowCreateModal(false)}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <MultiSelect
                label="Contract Type"
                value={modalContractTypeIds}
                onChange={(vals: string[]) => {
                  if ((vals as any)?.includes("__all__")) {
                    setModalContractTypeIds(contractTypes.map((c) => c.value));
                  } else {
                    setModalContractTypeIds(vals);
                  }
                  setModalEmploymentTypes([]);
                }}
                options={[
                  { label: "Select All", value: "__all__" },
                  ...contractTypes,
                ]}
                placeholder="Select one or more"
              />
              <div className="flex justify-end -mt-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setModalContractTypeIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            {isEmploymentSelected && (
              <div className="space-y-2">
                <MultiSelect
                  label="Employment Type"
                  value={modalEmploymentTypes}
                  onChange={(vals: string[]) => {
                    if ((vals as any)?.includes("__all__")) {
                      setModalEmploymentTypes(
                        employmentTypes.map((e) => e.value)
                      );
                    } else {
                      setModalEmploymentTypes(vals);
                    }
                  }}
                  options={[
                    { label: "Select All", value: "__all__" },
                    ...employmentTypes,
                  ]}
                  placeholder="Select one or more"
                />
                <div className="flex justify-end -mt-1">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setModalEmploymentTypes([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <MultiSelect
                label="Job Titles"
                value={modalDesignationIds}
                onChange={(vals: string[]) => {
                  if ((vals as any)?.includes("__all__")) {
                    setModalDesignationIds(designations.map((d) => d.value));
                  } else {
                    setModalDesignationIds(vals);
                  }
                }}
                options={[
                  { label: "Select All", value: "__all__" },
                  ...designations,
                ]}
                placeholder="Select one or more"
              />
              <div className="flex justify-end -mt-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setModalDesignationIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={confirmCreate}>Continue</Button>
            </div>
          </div>
        </Modal>
      </div>
    </PermissionGuard>
  );
}

function Modal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Transition appear show={visible} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
              <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-semibold">
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
