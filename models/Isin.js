import mongoose from "mongoose";

const IsinSchema = new mongoose.Schema({
  isin: { type: String, unique: true },
});

export default mongoose.model("Isin", IsinSchema);
