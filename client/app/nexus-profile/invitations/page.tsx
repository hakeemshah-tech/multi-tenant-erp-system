"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { MailCheck } from "lucide-react";

interface Invitation {
  _id: string;
  email: string;
  designationId: {
    name: string;
  };
  tenant: {
    name: string;
  };
  branchId: {
    name: string;
    _id: string;
  };
  token: string;
  status: "pending" | "accepted";
  createdAt: string;
  acceptedAt?: string;
  tenantId?: string;
}

export default function EmployeeInvitationsPage() {
  // Example: track viewing of invitations section (branch context may be in auth/user state)
  // useAuditView({ enabled: true, branchId: activeBranchId, sectionKey: "invitations" });
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    try {
      const res = await axiosInstance.get("/employee-invitation");
      setInvitations(res.data.data);
    } catch (err) {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Invitations</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and manage all invitations you've received to join organisations.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : invitations.length === 0 ? (
        <div className="text-gray-500 text-center py-16">
          You have no invitations at this time.
        </div>
      ) : (
        <div className="space-y-6">
          {invitations.map((inv) => (
            <div
              key={inv._id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 hover:shadow-md transition"
            >
              {/* Left section */}
              <div className="flex flex-col gap-1 text-sm text-gray-700">
                <h3 className="text-lg font-semibold text-gray-900">
                  {inv.branchId.name}
                </h3>
                <p className="text-sm">
                  <span className="font-medium text-gray-500">Job Title:</span>{" "}
                  {inv.designationId.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-gray-500">Sent:</span>{" "}
                  {format(new Date(inv.createdAt), "PPPp")}
                </p>
                {inv.acceptedAt && (
                  <p className="text-sm text-green-600 font-medium">
                    Accepted: {format(new Date(inv.acceptedAt), "PPPp")}
                  </p>
                )}
              </div>

              {/* Right section */}
              <div className="flex items-center justify-start sm:justify-end w-full sm:w-auto">
                {inv.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="solid"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() =>
                      window.location.assign(
                        `/accept-invite?token=${inv.token}&tenantId=${inv.tenantId}&branchId=${inv.branchId._id}`
                      )
                    }
                  >
                    Accept Invitation
                  </Button>
                ) : (
                  <Badge
                    color="success"
                    className="flex items-center gap-1 px-3 py-1"
                  >
                    <MailCheck size={16} />
                    Accepted
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
