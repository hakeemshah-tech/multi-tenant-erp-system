import { z } from "zod";

const rateSchema = z.object({
  level: z.number().positive("Level must be a positive number"),
  baseMinimumHourlyRates: z
    .number()
    .positive("Base minimum hourly rates must be a positive number"),
});

export const createHourlyRateManagementSchema = z
  .object({
    awardId: z.string().min(1, "Award ID is required"),
    awardEmployeeTypeId: z
      .string()
      .min(1, "Award Employee Type ID is required"),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()).optional(),
    rates: z.array(rateSchema).min(1, "At least one rate is required"),
  })
  .refine(
    (data) => {
      if (data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        return endDate >= startDate;
      }
      return true;
    },
    {
      message: "End date must be greater than or equal to start date",
      path: ["endDate"],
    }
  );

export const updateHourlyRateManagementSchema = z
  .object({
    awardId: z.string().min(1, "Award ID is required").optional(),
    awardEmployeeTypeId: z
      .string()
      .min(1, "Award Employee Type ID is required")
      .optional(),
    startDate: z.string().or(z.date()).optional(),
    endDate: z.string().or(z.date()).optional(),
    rates: z
      .array(rateSchema)
      .min(1, "At least one rate is required")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        return endDate >= startDate;
      }
      return true;
    },
    {
      message: "End date must be greater than or equal to start date",
      path: ["endDate"],
    }
  );
