import { Types } from "mongoose";
import {
  TemplateType,
  ITemplateType,
} from "@/database/models/templateType.model";

export async function createTemplateType(args: {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  contractTypeId: Types.ObjectId;
  title: string;
  description?: string;
}): Promise<ITemplateType> {
  const doc = await TemplateType.create({
    tenantId: args.tenantId,
    userId: args.userId,
    contractTypeId: args.contractTypeId,
    title: args.title,
    description: args.description,
  });
  return doc.toObject() as ITemplateType;
}

export async function listTemplateTypes(
  tenantId: Types.ObjectId,
  contractTypeId?: Types.ObjectId
): Promise<ITemplateType[]> {
  const filter: any = { tenantId, isDeleted: false };
  if (contractTypeId) filter.contractTypeId = contractTypeId;
  return TemplateType.find(filter).sort({ createdAt: -1 }).lean();
}

export async function updateTemplateType(
  tenantId: Types.ObjectId,
  id: Types.ObjectId,
  updates: Partial<Pick<ITemplateType, "title" | "description">>
): Promise<ITemplateType | null> {
  const updated = await TemplateType.findOneAndUpdate(
    { _id: id, tenantId, isDeleted: false },
    { $set: updates },
    { new: true }
  ).lean();
  return updated as any;
}
