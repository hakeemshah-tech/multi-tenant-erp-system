import { z } from "zod";

const addressSchema = z.object({
  buildingPropertyName: z.string().optional(),
  flatUnitNumber: z.string().optional(),
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  suburbCity: z.string().optional(),
  stateTerritory: z.string().optional(),
  country: z.string().optional(),
  zipPostalCode: z.string().optional(),
});

const physicalWorkLocationSchema = z.object({
  state: z.string().min(1, "State is required"),
  place: z.string().min(1, "Place is required"),
});

const officeWorkerHoursSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  weekDays: z.array(z.string()).optional(),
});

const shiftWorkerHoursSchema = z.object({
  description: z.string().optional(),
  weekDays: z.array(z.string()).optional(),
});

const businessHoursOfOperationSchema = z.object({
  officeWorker: officeWorkerHoursSchema.optional(),
  shiftWorker: shiftWorkerHoursSchema.optional(),
});

export const updateBranchDetailsSchema = z.object({
  logo: z.string().optional(),
  name: z.string().optional(),
  abn: z.string().optional(),
  acn: z.string().optional(),
  businessStructureId: z.string().optional(),
  industryTypeIds: z.array(z.string()).optional(),
  industrySubTypeIds: z.array(z.string()).optional(),
  addresses: z.array(addressSchema).optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  websiteUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
  physicalWorkLocations: z.array(physicalWorkLocationSchema).optional(),
  businessHoursOfOperation: businessHoursOfOperationSchema.optional(),
  isNotForProfit: z.boolean().optional(),
  isSalaryPackagingAvailable: z.boolean().optional(),
  salaryPackagingMaximumAmount: z.number().optional(),
});
