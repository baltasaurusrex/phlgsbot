import mongoose from "mongoose";

const IsinSchema = new mongoose.Schema({
  series: { type: String, unique: true },
  aliases: { type: [String], unique: true },
  isin: { type: String, unique: true },
  coupon_rate: { type: Number },
  issue_date: { type: Date },
  maturity_date: { type: Date },
  watchlist: { type: Boolean, default: false },
});

export default mongoose.model("Isin", IsinSchema);
