import mongoose from "mongoose";
import User from "./User.js";

const OrderSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    for: { type: String },
    series: { type: String, required: true },
    isin: { type: mongoose.Schema.Types.ObjectId, ref: "Isin" },
    orderType: { type: String, enum: ["bid", "offer"] },
    bid: { type: Number },
    bid_vol: { type: Number },
    offer: { type: Number },
    offer_vol: { type: Number },
    broker: {
      type: String,
      enum: ["Prebon", "Amstel", "Tradition", "GFI", "MOSB"],
    },
    time: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at" } }
);

export default mongoose.model("Order", OrderSchema);
