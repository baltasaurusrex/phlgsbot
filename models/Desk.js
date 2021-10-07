import mongoose from "mongoose";
import User from "./User.js";

const DeskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    aliases: { type: [String], unique: true },
    userIds: { type: [{ type: mongoose.SchemaTypes.ObjectId, ref: "User" }] },
  },
  { timestamps: { createdAt: "created_at" } }
);

export default mongoose.model("Desk", DeskSchema);
