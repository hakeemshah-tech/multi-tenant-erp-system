import mongoose, { Schema, Types } from "mongoose";

const employeeInvitationSchema = new Schema(
  {
    email: { type: String, required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    designationId: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      required: true,
    },
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const EmployeeInvitationModel = mongoose.model(
  "EmployeeInvitation",
  employeeInvitationSchema
);
export default EmployeeInvitationModel;
