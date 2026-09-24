import { Request, Response } from "express";
import { Types, startSession } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import {
  previewPropagation as svcPreview,
  applyPropagation as svcApply,
} from "./propagation.service";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";

/**
 * PREVIEW (self): body = { fieldKey, newValue }
 * Uses current user's employeeProfile
 */
export const previewPropagation = async (req: WithUser, res: Response) => {
  const user = req.user;
  const userId = user?.userId;
  const employeeFound = await EmployeeProfile.findOne({
    userId,
  })
    .select("_id")
    .lean();

  if (!employeeFound._id) {
    return res
      .status(400)
      .json({ message: "Employee profile not found on user." });
  }
  const profileId = new Types.ObjectId(employeeFound._id);
  const { fieldKey, newValue } = req.body || {};

  if (!fieldKey) {
    return res.status(400).json({ message: "fieldKey is required" });
  }

  const data = await svcPreview({ profileId, fieldKey, newValue });
  return res.status(200).json({ message: "Preview ready", data });
};

/**
 * APPLY (self): body = { fieldKey, newValue, targetBranchIds: string[], updateMainProfile?: boolean }
 */
// export const applyPropagation = async (req: WithUser, res: Response) => {
//   const user = req.user;
//   const profileIdStr = user?.userId;
//   if (!profileIdStr) {
//     return res
//       .status(400)
//       .json({ message: "Employee profile not found on user." });
//   }
//   const profileId = new Types.ObjectId(profileIdStr);

//   const {
//     fieldKey,
//     newValue,
//     targetBranchIds = [],
//     updateMainProfile = false,
//     useTransaction = false,
//   } = req.body || {};

//   if (!fieldKey) {
//     return res.status(400).json({ message: "fieldKey is required" });
//   }

//   if (!Array.isArray(targetBranchIds)) {
//     return res
//       .status(400)
//       .json({ message: "targetBranchIds must be an array (or omitted)." });
//   }

//   if (!useTransaction) {
//     const result = await svcApply({
//       profileId,
//       fieldKey,
//       newValue,
//       targetBranchIds,
//       updateMainProfile,
//     });
//     return res
//       .status(200)
//       .json({ message: "Propagation applied", data: result });
//   }

//   // Optional: wrap in transaction
//   const session = await startSession();
//   try {
//     await session.withTransaction(async () => {
//       await svcApply(
//         {
//           profileId,
//           fieldKey,
//           newValue,
//           targetBranchIds,
//           updateMainProfile,
//         },
//         session
//       );
//     });
//     return res.status(200).json({
//       message: "Propagation applied (txn)",
//       data: { ok: true },
//     });
//   } catch (err: any) {
//     return res
//       .status(500)
//       .json({ message: err?.message || "Failed to apply propagation" });
//   } finally {
//     await session.endSession();
//   }
// };

export const applyPropagation = async (req: WithUser, res: Response) => {
  try {
    // 0) Get the user's EmployeeProfile -> we need profileId for service layer
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: "Missing authenticated user." });
    }

    const profile = await EmployeeProfile.findOne({ userId }).lean();
    if (!profile) {
      return res
        .status(404)
        .json({ message: "Employee profile not found for user." });
    }
    const profileId = new Types.ObjectId(profile._id);

    // 1) Normalize payload
    const body = req.body || {};

    const fieldKey: string | undefined = body.fieldKey;
    // prefer new payload `currentValue`, fallback to legacy `newValue`
    const newValue =
      typeof body.currentValue !== "undefined"
        ? body.currentValue
        : body.newValue;

    // NEW payload selections
    let selections: Array<{ branchId: string; paths?: string[] }> = [];
    if (Array.isArray(body.selections)) {
      selections = body.selections
        .filter((s: any) => s && s.branchId)
        .map((s: any) => ({
          branchId: String(s.branchId),
          paths: Array.isArray(s.paths) ? s.paths.map(String) : undefined,
        }));
    } else if (Array.isArray(body.targetBranchIds)) {
      // LEGACY: convert targetBranchIds -> selections without paths
      selections = body.targetBranchIds.map((id: any) => ({
        branchId: String(id),
      }));
    }

    const updateMainProfile: boolean = !!body.updateMainProfile;
    const useTransaction: boolean = !!body.useTransaction;

    // 2) Validate minimal requirements
    if (!fieldKey) {
      return res.status(400).json({ message: "fieldKey is required" });
    }
    if (typeof newValue === "undefined") {
      return res
        .status(400)
        .json({ message: "currentValue/newValue is required" });
    }
    if (!Array.isArray(selections)) {
      return res.status(400).json({
        message:
          "selections (new) or targetBranchIds (legacy) must be an array.",
      });
    }

    // 3) Execute (optionally in a transaction)
    if (!useTransaction) {
      const result = await svcApply({
        profileId,
        fieldKey,
        newValue,
        selections,
        updateMainProfile,
      });
      return res
        .status(200)
        .json({ message: "Propagation applied", data: result });
    }

    const session = await startSession();
    try {
      let result: any = null;
      await session.withTransaction(async () => {
        result = await svcApply(
          { profileId, fieldKey, newValue, selections, updateMainProfile },
          session
        );
      });
      return res
        .status(200)
        .json({ message: "Propagation applied (txn)", data: result });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err?.message || "Failed to apply propagation" });
    } finally {
      await session.endSession();
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message || "Failed to apply propagation" });
  }
};
