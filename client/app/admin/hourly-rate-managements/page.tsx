"use client";

import { useEffect, useState } from "react";
import { Button, Table, Popover } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Trash2, Edit, Plus, DollarSign } from "lucide-react";
import HourlyRateManagementFormModal from "./components/HourlyRateManagementFormModal";

interface Rate {
  level: number;
  baseMinimumHourlyRates: number;
}

interface HourlyRateManagement {
  _id: string;
  awardId: {
    _id: string;
    title: string;
  };
  awardEmployeeTypeId: {
    _id: string;
    title: string;
  };
  startDate: string;
  endDate: string;
  rates: Rate[];
  createdAt?: string;
  updatedAt?: string;
}

export default function HourlyRateManagementsPage() {
  const [hourlyRateManagements, setHourlyRateManagements] = useState<
    HourlyRateManagement[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHourlyRateManagement, setSelectedHourlyRateManagement] =
    useState<HourlyRateManagement | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHourlyRateManagements = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/admin/hourly-rate-managements");
      setHourlyRateManagements(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch hourly rate managements", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to fetch hourly rate managements"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHourlyRateManagements();
  }, []);

  const handleDelete = async (hourlyRateManagement: HourlyRateManagement) => {
    try {
      setDeletingId(hourlyRateManagement._id);
      await axiosInstance.delete(
        `/admin/hourly-rate-managements/${hourlyRateManagement._id}`
      );
      toast.success("Hourly rate management deleted successfully");
      await fetchHourlyRateManagements();
    } catch (error: any) {
      console.error("Failed to delete hourly rate management", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to delete hourly rate management"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (hourlyRateManagement: HourlyRateManagement) => {
    setSelectedHourlyRateManagement(hourlyRateManagement);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedHourlyRateManagement(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedHourlyRateManagement(undefined);
  };

  const handleModalSuccess = () => {
    fetchHourlyRateManagements();
    handleModalClose();
  };

  return (
    <>
      <HourlyRateManagementFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={selectedHourlyRateManagement}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Hourly Rate Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage hourly rates for awards and employee types
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Hourly Rate
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading hourly rate managements...
            </div>
          ) : hourlyRateManagements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>
                No hourly rate managements found. Create your first hourly rate
                management to get started.
              </p>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Award</Table.Head>
                  <Table.Head>Employee Type</Table.Head>
                  <Table.Head>Start Date</Table.Head>
                  <Table.Head>End Date</Table.Head>
                  <Table.Head>Rates Count</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body className="text-sm">
                {hourlyRateManagements.map((hrm) => (
                  <Table.Row key={hrm._id}>
                    <Table.Cell className="font-medium">
                      {typeof hrm.awardId === "object" && hrm.awardId?.title
                        ? hrm.awardId.title
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {typeof hrm.awardEmployeeTypeId === "object" &&
                      hrm.awardEmployeeTypeId?.title
                        ? hrm.awardEmployeeTypeId.title
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {hrm.startDate
                        ? new Date(hrm.startDate).toLocaleDateString()
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {hrm.endDate
                        ? new Date(hrm.endDate).toLocaleDateString()
                        : "Ongoing"}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {hrm.rates?.length || 0} rates
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500">
                      {hrm.createdAt
                        ? new Date(hrm.createdAt).toLocaleDateString()
                        : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(hrm)}
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
                              disabled={deletingId === hrm._id}
                              className="flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </Popover.Trigger>
                          <Popover.Content>
                            {({ setOpen }) => (
                              <div className="w-64">
                                <h6 className="font-semibold mb-2">
                                  Delete Hourly Rate Management
                                </h6>
                                <p className="text-sm text-gray-600 mb-4">
                                  Are you sure you want to delete this hourly
                                  rate management? This action cannot be undone.
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
                                      handleDelete(hrm);
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
