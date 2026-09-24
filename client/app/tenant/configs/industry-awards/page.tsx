"use client";

import { useEffect, useState } from "react";
import { Button, Select } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit, Building2, Trophy, X } from "lucide-react";
import { useAppSelector } from "@/app/store/hook";
import BranchAwardModal from "./components/BranchAwardModal";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface Award {
  _id: string;
  title: string;
  description?: string;
  icon?: string;
}

interface AwardEmployeeType {
  _id: string;
  title: string;
  description?: string;
}

interface BranchAward {
  awardId: Award | string;
  awardEmployeeTypeIds: (AwardEmployeeType | string)[];
}

interface Branch {
  _id: string;
  name: string;
  location: string;
  awards?: BranchAward[];
}

export default function BranchAwardsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("industry-awards", "read");
  const canWrite = hasPermission("industry-awards", "write");
  const canDelete = hasPermission("industry-awards", "delete");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [awardEmployeeTypes, setAwardEmployeeTypes] = useState<
    AwardEmployeeType[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAward, setEditingAward] = useState<{
    awardId: string;
    awardEmployeeTypeIds: string[];
  } | null>(null);

  // Get current branch from user's active assignment
  const currentBranchId = user?.activeAssignment?.branchId;

  useEffect(() => {
    if (currentBranchId) {
      setSelectedBranchId(String(currentBranchId));
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchAwards();
    fetchAwardEmployeeTypes();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchAwards();
    }
  }, [selectedBranchId]);

  const fetchAwards = async () => {
    try {
      setAwardsLoading(true);
      const res = await axiosInstance.get("/awards");
      setAwards(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch awards", error);
      toast.error(error?.response?.data?.message || "Failed to fetch awards");
    } finally {
      setAwardsLoading(false);
    }
  };

  const fetchAwardEmployeeTypes = async () => {
    try {
      const res = await axiosInstance.get("/award-employee-types");
      setAwardEmployeeTypes(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch award employee types", error);
    }
  };

  const fetchBranchAwards = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/branches/${selectedBranchId}/awards`
      );
      setCurrentBranch(res.data.data);
    } catch (error: any) {
      console.error("Failed to fetch branch awards", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch branch awards"
      );
      setCurrentBranch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAward = () => {
    setEditingAward(null);
    setIsModalOpen(true);
  };

  const handleEditAward = (award: BranchAward) => {
    const awardId =
      typeof award.awardId === "object" ? award.awardId._id : award.awardId;
    const awardEmployeeTypeIds = award.awardEmployeeTypeIds.map((type) =>
      typeof type === "object" ? type._id : type
    );
    setEditingAward({ awardId, awardEmployeeTypeIds });
    setIsModalOpen(true);
  };

  const handleDeleteAward = async (awardId: string) => {
    if (
      !confirm("Are you sure you want to remove this award from the branch?")
    ) {
      return;
    }

    try {
      await axiosInstance.delete(
        `/branches/${selectedBranchId}/awards/${awardId}`
      );
      toast.success("Award removed successfully");
      fetchBranchAwards();
    } catch (error: any) {
      console.error("Failed to delete award", error);
      const errorMessage =
        error?.response?.data?.message || "Failed to remove award";
      toast.error(errorMessage);
    }
  };

  const handleModalSuccess = () => {
    fetchBranchAwards();
    setIsModalOpen(false);
    setEditingAward(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAward(null);
  };

  // Get available awards (not already added to branch)
  const availableAwards = awards.filter((award) => {
    if (!currentBranch?.awards) return true;
    return !currentBranch.awards.some((ba) => {
      const baAwardId =
        typeof ba.awardId === "object" ? ba.awardId._id : ba.awardId;
      return String(baAwardId) === String(award._id);
    });
  });

  return (
    <PermissionGuard
      section="industry-awards"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Branch Awards
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage awards and award employee types for your branch
            </p>
          </div>
          {selectedBranchId && canWrite && (
            <Button
              onClick={handleAddAward}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              disabled={awardsLoading}
            >
              <Plus size={18} />
              Add Award
              {awardsLoading && " (Loading...)"}
            </Button>
          )}
        </div>

        {/* Awards List */}
        {loading ? (
          <Card className="p-8 text-center text-gray-500">
            Loading branch awards...
          </Card>
        ) : !selectedBranchId ? (
          <Card className="p-8 text-center text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Please select a branch to manage awards</p>
          </Card>
        ) : !currentBranch?.awards || currentBranch.awards.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="mb-4">No awards configured for this branch yet.</p>
            {canWrite && (
              <Button
                onClick={handleAddAward}
                variant="outline"
                disabled={awardsLoading || availableAwards.length === 0}
              >
                Add Your First Award
                {awardsLoading && " (Loading...)"}
              </Button>
            )}
            {!awardsLoading &&
              availableAwards.length === 0 &&
              awards.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  All available awards have been added to this branch
                </p>
              )}
            {!awardsLoading && awards.length === 0 && (
              <p className="text-xs text-red-600 mt-2">
                No awards available. Please contact an administrator to create
                awards first.
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {currentBranch.awards.map((branchAward, index) => {
              const award =
                typeof branchAward.awardId === "object"
                  ? branchAward.awardId
                  : awards.find((a) => a._id === branchAward.awardId);
              const awardId =
                typeof branchAward.awardId === "object"
                  ? branchAward.awardId._id
                  : branchAward.awardId;

              if (!award) return null;

              return (
                <Card key={index} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {award.icon ? (
                        <span className="text-3xl">{award.icon}</span>
                      ) : (
                        <Trophy className="w-8 h-8 text-blue-600" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {award.title}
                        </h3>
                        {award.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {award.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAward(branchAward)}
                          className="flex items-center gap-1"
                        >
                          <Edit size={14} />
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="outline"
                          color="danger"
                          onClick={() => handleDeleteAward(awardId)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Award Employee Types */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Award Employee Types (
                      {branchAward.awardEmployeeTypeIds.length})
                    </h4>
                    {branchAward.awardEmployeeTypeIds.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No award employee types assigned
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {branchAward.awardEmployeeTypeIds.map(
                          (type, typeIndex) => {
                            const awardEmployeeType =
                              typeof type === "object"
                                ? type
                                : awardEmployeeTypes.find(
                                    (aet) => aet._id === type
                                  );
                            if (!awardEmployeeType) return null;
                            return (
                              <span
                                key={typeIndex}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {awardEmployeeType.title}
                              </span>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && selectedBranchId && (
          <BranchAwardModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
            branchId={selectedBranchId}
            awards={availableAwards}
            awardEmployeeTypes={awardEmployeeTypes}
            editingAward={editingAward}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
