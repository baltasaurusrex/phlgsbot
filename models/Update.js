import mongoose from "mongoose";

const UpdateSchema = new mongoose.Schema({
  isin: { type: mongoose.Schema.Types.ObjectId, ref: "Isin" },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bid: { type: Number, required: true },
  bidVol: { type: Number, required: true },
  offer: { type: Number, required: true },
  offerVol: { type: Number, required: true },
  last: { type: Number },
  direction: { type: String, enum: ["taken", "given", "mapped"] },
});

export default mongoose.model("Update", UpdateSchema);
