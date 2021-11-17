import User from "../models/User.js";

export const createUser = async (userDetails, role) => {
  const { name, id: viberId } = userDetails;
  const newUser = new User({
    name,
    viberId,
    role,
  });
  const res = await newUser.save();
  return res;
};

export const findUser = async (viberId) => {
  const user = await User.findOne({ viberId }).exec();

  return user;
};

export const fetchAdmins = async () => {
  try {
    console.log("in fetchAdmins controller");
    const admins = await User.find({ role: "admin" });
    return admins;
  } catch (err) {
    return err;
  }
};

export const fetchDealers = async (options) => {
  try {
    console.log("in fetchDealers controller");

    let mongoQuery = {
      role: "dealer",
    };

    if (options.updates) {
      if (options.updates.time_and_sales) {
        mongoQuery[`updates.time_and_sales`] = true;
      }
      if (options.updates.prices) {
        mongoQuery[`updates.prices`] = true;
      }
    }

    console.log("mongoQuery: ", mongoQuery);

    const users = await User.find(mongoQuery);

    return users;
  } catch (err) {
    console.log("error in fetchUsers: ", err);
    return err;
  }
};
