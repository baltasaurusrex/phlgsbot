import mongoose from "mongoose";

const OHLCSchema = new mongoose.Schema({
  isin: { type: String },
  series: { type: String },
  open: { type: Number },
  high: { type: Number },
  low: { type: Number },
  close: { type: Number },
  volume: { type: Number },
  date: { type: Date },
  time: { type: Date },
});

// time is for intraday
// date is to filter via date only

export default mongoose.model("OHLC", OHLCSchema);
