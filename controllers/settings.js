import Settings from "../models/Settings.js";
import { getBBAId } from "../utils/admin.js";

const BBAId = await getBBAId();

export const create_settings = async (id) => {
  try {
    const settings = new Settings({
      id,
    });
  } catch (err) {
    return err;
  }
};

export const fetch_settings = async () => {
  try {
    const settings = await Settings.findOne({ user: BBAId });
    return settings;
  } catch (err) {
    return err;
  }
};

export const toggle_auto_upload = async () => {
  try {
    const updated_settings = await Settings.findOneAndUpdate(
      { user: BBAId },
      [{ $set: { auto_upload: { $not: "$auto_upload" } } }],
      { new: true }
    );

    return updated_settings.auto_upload;
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
