import { z } from "zod";

export const addBranchAwardSchema = z.object({
  awardId: z.string().min(1, "Award ID is required"),
  awardEmployeeTypeIds: z
    .array(z.string().min(1))
    .min(1, "At least one award employee type is required"),
});

export const updateBranchAwardSchema = z.object({
  awardEmployeeTypeIds: z
    .array(z.string().min(1))
    .min(1, "At least one award employee type is required"),
});
