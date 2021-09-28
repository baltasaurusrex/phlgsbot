import mongoose from "mongoose";

const IsinSchema = new mongoose.Schema({
  series: { type: String, unique: true },
  aliases: { type: [String], unique: true },
  isin: { type: String, unique: true },
  maturity: { type: Date },
});

export default mongoose.model("Isin", IsinSchema);
