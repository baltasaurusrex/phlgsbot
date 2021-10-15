import User from "../models/User.js";

export const getBBAId = async () => {
  return await User.findOne({ viberId: "GLFVU5NMrftatUawMgsJug==" });
};
