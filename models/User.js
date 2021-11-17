import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String },
  viberId: { type: String, unique: true },
  role: { type: String, enum: ["dealer", "broker", "admin"] },
  brokerFirm: {
    type: String,
    required: function () {
      return this.role === "broker" ? true : false;
    },
    enum: ["Amstel", "Prebon", "Tradition", "GFI"],
  },
  updates: {
    time_and_sales: { type: Boolean, default: false },
    prices: { type: Boolean, default: false },
  },
});

export default mongoose.model("User", UserSchema);
