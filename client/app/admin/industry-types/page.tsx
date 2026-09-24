"use client";

import { useEffect, useState } from "react";
import { Button, Table, Modal, Title, Text, Popover } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, Factory } from "lucide-react";
import IndustryTypeFormModal from "./components/IndustryTypeFormModal";

interface IndustryType {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function IndustryTypesPage() {
  const [industryTypes, setIndustryTypes] = useState<IndustryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIndustryType, setSelectedIndustryType] = useState<
    IndustryType | undefined
  >(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchIndustryTypes = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/admin/industry-types");
      setIndustryTypes(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch industry types", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch industry types"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndustryTypes();
  }, []);

  const handleDelete = async (industryType: IndustryType) => {
    try {
      setDeletingId(industryType._id);
      await axiosInstance.delete(`/admin/industry-types/${industryType._id}`);
      toast.success("Industry type deleted successfully");
      await fetchIndustryTypes();
    } catch (error: any) {
      console.error("Failed to delete industry type", error);
      toast.error(
        error.response?.data?.message || "Failed to delete industry type"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (industryType: IndustryType) => {
    setSelectedIndustryType(industryType);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedIndustryType(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedIndustryType(undefined);
  };

  const handleModalSuccess = () => {
    fetchIndustryTypes();
    handleModalClose();
  };

  return (
    <>
      <IndustryTypeFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={selectedIndustryType}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Industry Types
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage industry type classifications
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Industry Type
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading industry types...
            </div>
          ) : industryTypes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Factory className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>
                No industry types found. Create your first industry type to get
                started.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>Description</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body className="text-sm">
                {industryTypes.map((industryType) => (
                  <Table.Row key={industryType._id}>
                    <Table.Cell className="font-medium">
                      {industryType.name}
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      <p className="truncate text-gray-600">
                        {industryType.description || "—"}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          industryType.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {industryType.isActive ? "Active" : "Inactive"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500">
                      {industryType.createdAt
                        ? new Date(industryType.createdAt).toLocaleDateString()
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(industryType)}
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
                              disabled={deletingId === industryType._id}
                              className="flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Popover.Trigger>
                          <Popover.Content>
                            {({ setOpen }) => (
                              <div className="w-64">
                                <Title as="h6">Delete Industry Type</Title>
                                <Text className="mt-2">
                                  Are you sure you want to delete "
                                  {industryType.name}"? This action cannot be
                                  undone.
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
                                      handleDelete(industryType);
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
