import Settings from "../models/Settings.js";
import { getBBAId } from "../utils/admin.js";

export const create_settings = async () => {
  const BBAId = await getBBAId();

  try {
    const current = await Settings.findOne({ user: BBAId }).lean();
    if (!current) {
      let settings = new Settings({
        user: BBAId,
      });
      settings = await setting.save().lean();
      return { message: "New settings created.", settings };
    } else {
      return { message: "Already has settings.", settings: current };
    }
  } catch (err) {
    return err;
  }
};

export const fetch_settings = async () => {
  try {
    const BBAId = await getBBAId();
    const settings = await Settings.findOne({ user: BBAId }).lean();
    return settings;
  } catch (err) {
    return err;
  }
};

export const toggle_auto_upload = async (on) => {
  try {
    console.log("in toggle_auto_upload: ", on);
    const BBAId = await getBBAId();
    const updated_settings = await Settings.findOneAndUpdate(
      { user: BBAId },
      { auto_upload: on ? true : false },
      { new: true }
    );

    return updated_settings;
  } catch (err) {
    return err;
  }
};

export const update_settings = async () => {
  try {
  } catch (err) {
    return err;
  }
};
