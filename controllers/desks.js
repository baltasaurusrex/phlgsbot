import Desk from "../models/Desk.js";
import mongoose from "mongoose";

export const getValidNicknames = async () => {
  try {
    const desksWithAliases = await Desk.find({ aliases: { $exists: true } });

    let list = [];

    desksWithAliases.forEach((desk) => list.push(...desk.aliases));

    return list;
  } catch (err) {
    return err;
  }
};

export const getValidDesks = async () => {
  try {
    const desks = await Desk.find();
    return desks.map((desk) => desk.name);
  } catch (err) {
    return err;
  }
};

export const getDesk = async (aliasOrId) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(aliasOrId);

  try {
    if (isObjectId) {
      const desk = await Desk.findOne({
        userIds: aliasOrId,
      });
      return desk?.name;
    } else {
      const desk = await Desk.findOne({
        aliases: { $regex: `${aliasOrId}`, $options: "gi" },
      });
      return desk?.name;
    }
  } catch (err) {
    return err;
  }
};
