import { FilterQuery, Types } from "mongoose";
import {
  ContractTemplate,
  IContractTemplate,
} from "@/database/models/contractTemplate.model";

export type CreateContractTemplateArgs = {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  userId: Types.ObjectId;
  contractTypeIds: Types.ObjectId[];
  employmentTypes?: string[];
  designationIds?: Types.ObjectId[];
  title: string;
  description?: string;
  version?: string;
  recommended?: boolean;
  builder?: any;
};

export async function create(
  args: CreateContractTemplateArgs
): Promise<IContractTemplate> {
  const doc = await ContractTemplate.create({
    tenantId: args.tenantId,
    branchId: args.branchId,
    userId: args.userId,
    contractTypeIds: args.contractTypeIds ?? [],
    employmentTypes: args.employmentTypes ?? [],
    designationIds: args.designationIds ?? [],
    title: args.title,
    description: args.description,
    version: args.version || "v1",
    recommended: args.recommended ?? false,
    status: "draft",
    builder: args.builder || {},
  });
  return doc.toObject() as IContractTemplate;
}

export type ListQuery = {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  search?: string;
  contractTypeId?: Types.ObjectId;
  employmentType?: string;
  designationId?: Types.ObjectId;
};

export async function list(query: ListQuery): Promise<IContractTemplate[]> {
  const filter: FilterQuery<IContractTemplate> = {
    tenantId: query.tenantId,
    branchId: query.branchId,
    isDeleted: false,
  };
  if (query.contractTypeId)
    (filter as any).contractTypeIds = query.contractTypeId;
  if (query.employmentType)
    (filter as any).employmentTypes = query.employmentType;
  if (query.designationId) (filter as any).designationIds = query.designationId; // match any containing this id
  if (query.search) {
    (filter as any).$or = [
      { title: { $regex: query.search, $options: "i" } },
      { description: { $regex: query.search, $options: "i" } },
    ];
  }
  return ContractTemplate.find(filter)
    .populate({
      path: "designationIds",
      select: "name _id",
      options: { lean: true },
    })
    .populate({
      path: "contractTypeIds",
      select: "title _id",
      options: { lean: true },
    })
    .sort({ createdAt: -1 })
    .lean();
}

// createMultiple no longer needed; single document stores arrays

export async function remove(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  id: Types.ObjectId
): Promise<boolean> {
  const res = await ContractTemplate.updateOne(
    { _id: id, tenantId, branchId, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );
  return res.modifiedCount > 0;
}

export async function getById(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  id: Types.ObjectId
): Promise<IContractTemplate | null> {
  return ContractTemplate.findOne({
    _id: id,
    tenantId,
    branchId,
    isDeleted: false,
  }).lean();
}

export type UpdateContractTemplateArgs = Partial<{
  title: string;
  description: string;
  version: string;
  recommended: boolean;
  builder: any;
  employmentTypes: string[];
  contractTypeIds: Types.ObjectId[];
  designationIds: Types.ObjectId[];
}>;

export async function update(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  id: Types.ObjectId,
  payload: UpdateContractTemplateArgs
): Promise<IContractTemplate | null> {
  await ContractTemplate.updateOne(
    { _id: id, tenantId, branchId, isDeleted: false },
    { $set: { ...payload } }
  );
  return getById(tenantId, branchId, id);
}

export async function publish(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  id: Types.ObjectId
): Promise<IContractTemplate | null> {
  await ContractTemplate.updateOne(
    { _id: id, tenantId, branchId, isDeleted: false },
    { $set: { status: "published", publishedAt: new Date() } }
  );
  return getById(tenantId, branchId, id);
}

export async function duplicate(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId,
  userId: Types.ObjectId,
  id: Types.ObjectId,
  { version }: { version: string }
): Promise<IContractTemplate> {
  const src = await ContractTemplate.findOne({
    _id: id,
    tenantId,
    branchId,
    isDeleted: false,
  }).lean();
  if (!src) throw new Error("Template not found");
  const copy = await ContractTemplate.create({
    tenantId,
    branchId,
    userId,
    contractTypeIds: src.contractTypeIds,
    employmentTypes: src.employmentTypes || [],
    designationIds: src.designationIds || [],
    title: src.title,
    description: src.description,
    version,
    recommended: src.recommended || false,
    status: "draft",
    builder: src.builder || {},
  });
  return copy.toObject() as IContractTemplate;
}
