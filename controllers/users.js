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
  console.log("foundUser: ", user);
  return user;
};
