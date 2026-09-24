import { Response } from "express";
import { WithUser } from "@/common/middlewares/authMiddleware";
import EmploymentSettingsMaster from "@/database/models/EmploymentSettingsMaster.model";

/**
 * @desc Get employment settings master data
 * @route GET /admin/employment-settings-master
 */
export const getEmploymentSettingsMaster = async (
  req: WithUser,
  res: Response
) => {
  try {
    const master = await EmploymentSettingsMaster.getOrCreate();
    return res.status(200).json({
      message: "Employment settings master data fetched successfully",
      data: master,
    });
  } catch (error: any) {
    console.error("Error fetching employment settings master:", error);
    return res.status(500).json({
      message: "Failed to fetch employment settings master data",
      error: error.message,
    });
  }
};

/**
 * @desc Update employment settings master data
 * @route PUT /admin/employment-settings-master
 */
export const updateEmploymentSettingsMaster = async (
  req: WithUser,
  res: Response
) => {
  try {
    const { worktype, employeetype, employmentstatus } = req.body;

    const master = await EmploymentSettingsMaster.getOrCreate();

    // Update options while preserving default options
    if (worktype?.options !== undefined) {
      if (Array.isArray(worktype.options)) {
        master.worktype.options = worktype.options;
      }
    }

    if (employeetype?.options !== undefined) {
      if (Array.isArray(employeetype.options)) {
        master.employeetype.options = employeetype.options;
      }
    }

    if (employmentstatus?.options !== undefined) {
      if (Array.isArray(employmentstatus.options)) {
        master.employmentstatus.options = employmentstatus.options;
      }
    }

    await master.save();

    return res.status(200).json({
      message: "Employment settings master data updated successfully",
      data: master,
    });
  } catch (error: any) {
    console.error("Error updating employment settings master:", error);
    return res.status(500).json({
      message: "Failed to update employment settings master data",
      error: error.message,
    });
  }
};
