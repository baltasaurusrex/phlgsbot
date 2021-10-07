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

export const getDesk = async (aliasOrId) => {
  console.log("aliasOrId: ", aliasOrId);
  console.log("typeof aliasOrId: ", typeof aliasOrId);
  const isObjectId = mongoose.Types.ObjectId.isValid(aliasOrId);
  console.log("isObjectId: ", isObjectId);
  try {
    let desk = null;

    if (isObjectId) {
      desk = await Desk.findOne({
        userIds: aliasOrId,
      });
    } else {
      desk = await Desk.findOne({
        aliases: { $regex: `${aliasOrId}`, $options: "gi" },
      });
    }

    console.log("desk: ", desk);

    return desk.name;
  } catch (err) {
    return err;
  }
};
