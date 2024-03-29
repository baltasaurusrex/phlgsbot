import mongoose from "mongoose";
import User from "./User.js";

const UpdateSchema = new mongoose.Schema(
  {
    series: { type: String, required: true },
    isin: { type: String, required: true },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: { type: String, enum: ["bid_offer", "last_dealt"] },
    bid: { type: Number },
    bid_vol: { type: Number },
    offer: { type: Number },
    offer_vol: { type: Number },
    lastDealt: { type: Number },
    lastDealtVol: { type: Number },
    direction: {
      type: String,
      enum: ["taken", "given", "taken", "lifted", "mapped"],
      default: "mapped",
    },
    broker: {
      type: String,
      enum: ["Prebon", "Amstel", "Tradition", "GFI", "MOSB"],
      default: "MOSB",
    },
    time: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at" } }
);

export default mongoose.model("Update", UpdateSchema);

// make a post middleware that creates (or updates) OHLC data when new data is uploaded (?)
