import { Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as service from "./templateType.service";

export async function create(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const userId = new Types.ObjectId(req.user.userId);
  const { title, description, contractTypeId } = req.body;
  const doc = await service.createTemplateType({
    tenantId,
    userId,
    contractTypeId: new Types.ObjectId(contractTypeId),
    title,
    description,
  });
  return res.status(201).json({ message: "Template type created", data: doc });
}

export async function list(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const { contractTypeId } = req.query as { contractTypeId?: string };
  const filterId = contractTypeId
    ? new Types.ObjectId(contractTypeId)
    : undefined;
  const docs = await service.listTemplateTypes(tenantId, filterId);
  return res
    .status(200)
    .json({ message: "Fetched template types", data: docs });
}

export async function update(req: WithUser, res: Response) {
  const tenantId = new Types.ObjectId(req.user.activeAssignment.tenantId);
  const id = new Types.ObjectId(req.params.id);
  const updated = await service.updateTemplateType(tenantId, id, req.body);
  return res
    .status(200)
    .json({ message: "Updated template type", data: updated });
}
