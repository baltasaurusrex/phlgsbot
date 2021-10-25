import PendingQuery from "../models/PendingQuery.js";
import Order from "../models/Order.js";

export const createPendingQuery = async (user, attachment) => {
  console.log("in createPendingQuery: ");
  console.log("attachment: ", attachment);
  try {
    let type = null;

    // check if there's an existing PendingQuery

    if (await Order.findById(attachment)) type = "dealt_order";
    const pendingQuery = new PendingQuery({
      creator: user,
      type,
      attachment,
    });

    const doc = await pendingQuery.save();

    return doc;
  } catch (err) {
    return err;
  }
};

export const checkPendingQueries = async (user) => {
  try {
    const res = await PendingQuery.find({
      creator: user,
      status: "pending",
    })
      .populate("attachment")
      .sort({ time: -1 });
    return res;
  } catch (err) {
    return err;
  }
};

export const completePendingQuery = async (pendingQuery) => {
  try {
    const res = await PendingQuery.findByIdAndUpdate(
      pendingQuery,
      {
        status: "complete",
      },
      {
        new: true,
      }
    );
  } catch (err) {
    return err;
  }
};
