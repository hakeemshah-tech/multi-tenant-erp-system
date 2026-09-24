import { Response } from "express";
import { WithUser } from "@/common/middlewares/authMiddleware";
import PersonalSettingsMaster from "@/database/models/PersonalSettingsMaster.model";

/**
 * @desc Get personal settings master data
 * @route GET /admin/personal-settings-master
 */
export const getPersonalSettingsMaster = async (
  req: WithUser,
  res: Response
) => {
  try {
    const master = await PersonalSettingsMaster.getOrCreate();
    return res.status(200).json({
      message: "Personal settings master data fetched successfully",
      data: master,
    });
  } catch (error: any) {
    console.error("Error fetching personal settings master:", error);
    return res.status(500).json({
      message: "Failed to fetch personal settings master data",
      error: error.message,
    });
  }
};

/**
 * @desc Update personal settings master data
 * @route PUT /admin/personal-settings-master
 */
export const updatePersonalSettingsMaster = async (
  req: WithUser,
  res: Response
) => {
  try {
    const { gender, pronouns, residencystatus, typeofvisa } = req.body;

    const master = await PersonalSettingsMaster.getOrCreate();

    // Update options while preserving default options
    if (gender?.options !== undefined) {
      if (Array.isArray(gender.options)) {
        master.gender.options = gender.options;
      }
    }

    if (pronouns?.options !== undefined) {
      if (Array.isArray(pronouns.options)) {
        master.pronouns.options = pronouns.options;
      }
    }

    if (residencystatus?.options !== undefined) {
      if (Array.isArray(residencystatus.options)) {
        master.residencystatus.options = residencystatus.options;
      }
    }

    if (typeofvisa?.options !== undefined) {
      if (Array.isArray(typeofvisa.options)) {
        master.typeofvisa.options = typeofvisa.options;
      }
    }

    await master.save();

    return res.status(200).json({
      message: "Personal settings master data updated successfully",
      data: master,
    });
  } catch (error: any) {
    console.error("Error updating personal settings master:", error);
    return res.status(500).json({
      message: "Failed to update personal settings master data",
      error: error.message,
    });
  }
};
