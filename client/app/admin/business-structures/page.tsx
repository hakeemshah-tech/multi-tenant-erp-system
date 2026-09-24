"use client";

import { useEffect, useState } from "react";
import { Button, Table, Modal, Title, Text, Popover } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, Building2 } from "lucide-react";
import BusinessStructureFormModal from "./components/BusinessStructureFormModal";

interface BusinessStructure {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function BusinessStructuresPage() {
  const [businessStructures, setBusinessStructures] = useState<
    BusinessStructure[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBusinessStructure, setSelectedBusinessStructure] = useState<
    BusinessStructure | undefined
  >(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBusinessStructures = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/admin/business-structures");
      setBusinessStructures(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch business structures", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch business structures"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessStructures();
  }, []);

  const handleDelete = async (businessStructure: BusinessStructure) => {
    try {
      setDeletingId(businessStructure._id);
      await axiosInstance.delete(
        `/admin/business-structures/${businessStructure._id}`
      );
      toast.success("Business structure deleted successfully");
      await fetchBusinessStructures();
    } catch (error: any) {
      console.error("Failed to delete business structure", error);
      toast.error(
        error.response?.data?.message || "Failed to delete business structure"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (businessStructure: BusinessStructure) => {
    setSelectedBusinessStructure(businessStructure);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedBusinessStructure(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedBusinessStructure(undefined);
  };

  const handleModalSuccess = () => {
    fetchBusinessStructures();
    handleModalClose();
  };

  return (
    <>
      <BusinessStructureFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={selectedBusinessStructure}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Business Structures
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage business structure types and classifications
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Business Structure
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading business structures...
            </div>
          ) : businessStructures.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>
                No business structures found. Create your first business
                structure to get started.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>Code</Table.Head>
                  <Table.Head>Description</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body className="text-sm">
                {businessStructures.map((businessStructure) => (
                  <Table.Row key={businessStructure._id}>
                    <Table.Cell className="font-medium">
                      {businessStructure.name}
                    </Table.Cell>
                    <Table.Cell>
                      {businessStructure.code ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                          {businessStructure.code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      <p className="truncate text-gray-600">
                        {businessStructure.description || "—"}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          businessStructure.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {businessStructure.isActive ? "Active" : "Inactive"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500">
                      {businessStructure.createdAt
                        ? new Date(
                            businessStructure.createdAt
                          ).toLocaleDateString()
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(businessStructure)}
                          className="flex items-center gap-1"
                        >
                          <Edit size={14} />
                          Edit
                        </Button>
                        <Popover>
                          <Popover.Trigger>
                            <Button
                              size="sm"
                              variant="outline"
                              color="danger"
                              disabled={deletingId === businessStructure._id}
                              className="flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Popover.Trigger>
                          <Popover.Content>
                            {({ setOpen }) => (
                              <div className="w-64">
                                <Title as="h6">Delete Business Structure</Title>
                                <Text className="mt-2">
                                  Are you sure you want to delete "
                                  {businessStructure.name}"? This action cannot
                                  be undone.
                                </Text>
                                <div className="flex justify-end gap-3 mt-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    color="danger"
                                    onClick={() => {
                                      handleDelete(businessStructure);
                                      setOpen(false);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Popover.Content>
                        </Popover>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
