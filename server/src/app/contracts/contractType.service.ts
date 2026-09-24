import { Types } from "mongoose";
import {
  ContractType,
  IContractType,
} from "@/database/models/contractType.model";

export async function createContractType(args: {
  tenantId?: Types.ObjectId;
  userId?: Types.ObjectId;
  title: string;
  description?: string;
}): Promise<IContractType> {
  const doc = await ContractType.create({
    tenantId: args.tenantId,
    userId: args.userId,
    title: args.title,
    description: args.description,
  });
  return doc.toObject() as IContractType;
}

export async function listContractTypes(): Promise<IContractType[]> {
  return ContractType.find({ isDeleted: false }).sort({ createdAt: -1 }).lean();
}

export async function updateContractType(
  id: Types.ObjectId,
  updates: Partial<Pick<IContractType, "title" | "description">>
): Promise<IContractType | null> {
  const updated = await ContractType.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: updates },
    { new: true }
  ).lean();
  return updated as any;
}
