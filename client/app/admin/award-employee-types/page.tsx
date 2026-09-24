"use client";

import { useEffect, useState } from "react";
import { Button, Table, Popover } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, UserCheck } from "lucide-react";
import AwardEmployeeTypeFormModal from "./components/AwardEmployeeTypeFormModal";
//
interface AwardEmployeeType {
  _id: string;
  title: string;
  description?: string;
  awardId?: string | { _id: string; title: string };
  createdAt?: string;
  updatedAt?: string;
}

export default function AwardEmployeeTypesPage() {
  const [awardEmployeeTypes, setAwardEmployeeTypes] = useState<
    AwardEmployeeType[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAwardEmployeeType, setSelectedAwardEmployeeType] = useState<
    AwardEmployeeType | undefined
  >(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAwardEmployeeTypes = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/admin/award-employee-types");
      setAwardEmployeeTypes(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch award employee types", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch award employee types"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAwardEmployeeTypes();
  }, []);

  const handleDelete = async (awardEmployeeType: AwardEmployeeType) => {
    try {
      setDeletingId(awardEmployeeType._id);
      await axiosInstance.delete(
        `/admin/award-employee-types/${awardEmployeeType._id}`
      );
      toast.success("Award employee type deleted successfully");
      await fetchAwardEmployeeTypes();
    } catch (error: any) {
      console.error("Failed to delete award employee type", error);
      toast.error(
        error.response?.data?.message || "Failed to delete award employee type"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (awardEmployeeType: AwardEmployeeType) => {
    setSelectedAwardEmployeeType(awardEmployeeType);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedAwardEmployeeType(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedAwardEmployeeType(undefined);
  };

  const handleModalSuccess = () => {
    fetchAwardEmployeeTypes();
    handleModalClose();
  };

  return (
    <>
      <AwardEmployeeTypeFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={selectedAwardEmployeeType}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Award Employee Types
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage award employee type categories
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Award Employee Type
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading award employee types...
            </div>
          ) : awardEmployeeTypes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <UserCheck className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>
                No award employee types found. Create your first award employee
                type to get started.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Award</Table.Head>
                  <Table.Head>Title</Table.Head>
                  <Table.Head>Description</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body className="text-sm">
                {awardEmployeeTypes.map((awardEmployeeType) => {
                  const awardTitle =
                    typeof awardEmployeeType.awardId === "object"
                      ? awardEmployeeType.awardId.title
                      : "—";

                  return (
                    <Table.Row key={awardEmployeeType._id}>
                      <Table.Cell className="font-medium">
                        {awardTitle}
                      </Table.Cell>
                      <Table.Cell className="font-medium">
                        {awardEmployeeType.title}
                      </Table.Cell>
                      <Table.Cell className="max-w-md">
                        <p className="truncate text-gray-600">
                          {awardEmployeeType.description || "—"}
                        </p>
                      </Table.Cell>
                      <Table.Cell className="text-gray-500">
                        {awardEmployeeType.createdAt
                          ? new Date(
                              awardEmployeeType.createdAt
                            ).toLocaleDateString()
                          : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(awardEmployeeType)}
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
                                disabled={deletingId === awardEmployeeType._id}
                                className="flex items-center gap-1"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </Popover.Trigger>
                            <Popover.Content>
                              {({ setOpen }) => (
                                <div className="w-64">
                                  <h6 className="font-semibold mb-2">
                                    Delete Award Employee Type
                                  </h6>
                                  <p className="text-sm text-gray-600 mb-4">
                                    Are you sure you want to delete "
                                    {awardEmployeeType.title}"? This action
                                    cannot be undone.
                                  </p>
                                  <div className="flex justify-end gap-3">
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
                                        handleDelete(awardEmployeeType);
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
                  );
                })}
              </Table.Body>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
