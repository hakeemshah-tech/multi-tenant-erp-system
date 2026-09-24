import { Response } from "express";
import { Types } from "mongoose";
import { WithUser } from "@/common/middlewares/authMiddleware";
import * as service from "./contractType.service";

export async function create(req: WithUser, res: Response) {
  const { title, description } = req.body;
  // Create globally (no tenant/user required)
  const doc = await service.createContractType({ title, description });
  return res.status(201).json({ message: "Contract type created", data: doc });
}

export async function list(req: WithUser, res: Response) {
  const docs = await service.listContractTypes();
  return res
    .status(200)
    .json({ message: "Fetched contract types", data: docs });
}

export async function update(req: WithUser, res: Response) {
  const id = new Types.ObjectId(req.params.id);
  const updated = await service.updateContractType(id, req.body);
  return res
    .status(200)
    .json({ message: "Updated contract type", data: updated });
}
