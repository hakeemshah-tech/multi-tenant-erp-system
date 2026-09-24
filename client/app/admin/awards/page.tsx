"use client";

import { useEffect, useState } from "react";
import { Button, Table, Modal, Title, Text, Popover } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, Trophy } from "lucide-react";
import AwardFormModal from "./components/AwardFormModal";

interface Award {
  _id: string;
  title: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function AwardsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAward, setSelectedAward] = useState<Award | undefined>(
    undefined
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAwards = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/admin/awards");
      setAwards(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch awards", error);
      toast.error(error.response?.data?.message || "Failed to fetch awards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAwards();
  }, []);

  const handleDelete = async (award: Award) => {
    try {
      setDeletingId(award._id);
      await axiosInstance.delete(`/admin/awards/${award._id}`);
      toast.success("Award deleted successfully");
      await fetchAwards();
    } catch (error: any) {
      console.error("Failed to delete award", error);
      toast.error(error.response?.data?.message || "Failed to delete award");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (award: Award) => {
    setSelectedAward(award);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedAward(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedAward(undefined);
  };

  const handleModalSuccess = () => {
    fetchAwards();
    handleModalClose();
  };

  return (
    <>
      <AwardFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={selectedAward}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Awards</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage platform awards and recognitions
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Award
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading awards...
            </div>
          ) : awards.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No awards found. Create your first award to get started.</p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Icon</Table.Head>
                  <Table.Head>Title</Table.Head>
                  <Table.Head>Description</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body className="text-sm">
                {awards.map((award) => (
                  <Table.Row key={award._id}>
                    <Table.Cell>
                      {award.icon ? (
                        <span className="text-2xl">{award.icon}</span>
                      ) : (
                        <Trophy className="w-6 h-6 text-gray-400" />
                      )}
                    </Table.Cell>
                    <Table.Cell className="font-medium">
                      {award.title}
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      <p className="truncate text-gray-600">
                        {award.description || "—"}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          award.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {award.isActive ? "Active" : "Inactive"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500">
                      {award.createdAt
                        ? new Date(award.createdAt).toLocaleDateString()
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(award)}
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
                              disabled={deletingId === award._id}
                              className="flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Popover.Trigger>
                          <Popover.Content>
                            {({ setOpen }) => (
                              <div className="w-64">
                                <Title as="h6">Delete Award</Title>
                                <Text className="mt-2">
                                  Are you sure you want to delete "{award.title}
                                  "? This action cannot be undone.
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
                                      handleDelete(award);
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
