import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema({
  user: {
    type: { type: mongoose.SchemaTypes.ObjectId, ref: "User" },
    unique: true,
  },
  auto_upload: { type: Boolean, default: false },
});

export default mongoose.model("Settings", SettingsSchema);
