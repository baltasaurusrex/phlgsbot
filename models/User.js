import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String },
  viberUserId: { type: String, unique: true },
  role: { type: String, enum: ["dealer", "broker", "admin"] },
});

export default mongoose.model("User", UserSchema);
