import { Request, Response } from "express";
import { Types } from "mongoose";
import * as invitationService from "./employeeInvitation.service";
import { WithUser } from "@/common/middlewares/authMiddleware";

export const getInvitations = async (req: WithUser, res: Response) => {
  const email = req.user.email;

  const invitations = await invitationService.getInvitationsByEmail(email);

  return res.status(200).json({
    message: "Invitations fetched successfully",
    data: invitations,
  });
};

export const createInvitation = async (req: WithUser, res: Response) => {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const branchId = new Types.ObjectId(req.user.activeAssignment.branchId);
  const { email, designationId } = req.body;

  const result = await invitationService.sendInvitation(
    tenantId,
    branchId,
    { email, designationId },
    {
      // 👇 pass-through for audit logging
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );
  return res
    .status(201)
    .json({ message: "Invitation sent successfully", data: result });
};

export const getInvitationPreview = async (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    const preview = await invitationService.getInvitationPreviewByToken(token);
    return res.status(200).json({
      message: "Invitation preview fetched successfully",
      data: preview,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Invalid invitation token",
    });
  }
};

export const acceptInvitation = async (req: WithUser, res: Response) => {
  const userId = req.user.userId;
  const token = req.body.token;

  const result = await invitationService.acceptInvitation(
    new Types.ObjectId(userId),
    token,
    {
      // 👇 pass-through for audit logging
      req,
      actorUserId: req.user.userId ?? null,
      actorEmail: req.user.email ?? null,
      actorName: req.user.fullName ?? null,
    }
  );

  // Generate new tokens with updated assignment
  if (result.user && result.user.activeAssignment) {
    const { generateTokens } = await import("@/app/auth/token.service");
    const assignment = result.user.activeAssignment;

    const payload = {
      userId: result.user._id.toString(),
      tenantId: assignment.tenantId.toString(),
      branchId: assignment.branchId.toString(),
      role: assignment.role,
    };

    const tokens = await generateTokens(payload);

    return res.status(200).json({
      message: "Invitation accepted",
      data: {
        ...result,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  }

  return res.status(200).json({ message: "Invitation accepted", data: result });
};
