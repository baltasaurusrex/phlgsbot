import mongoose from "mongoose";
import User from "./User.js";
import Update from "./Update.js";
import dayjs from "dayjs";
import { createPricesUpdate } from "../controllers/updates.js";

const OrderSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    forDesk: { type: String },
    series: { type: String, required: true },
    orderType: { type: String, enum: ["bid", "offer"], required: true },
    rate: { type: Number },
    vol: { type: Number },
    filledVol: { type: Number, default: 0 },
    broker: {
      type: String,
      enum: ["Prebon", "Amstel", "Tradition", "GFI", "MOSB"],
    },
    time: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "dealt"], default: "active" },
  },
  { timestamps: { createdAt: "created_at" } }
);

// there should be a middleware that creates/updates the most recent bid offer of that broker if this is created
OrderSchema.post("save", async function (doc) {
  const startOfToday = dayjs().startOf("day").toDate();
  const bidOfferUpdate = (
    await Update.find({
      type: "bid_offer",
      series: doc.series,
      broker: doc.broker,
      time: { $gte: startOfToday },
    }).sort({ time: "desc" })
  )[0];

  console.log("bidOfferUpdate: ", bidOfferUpdate);

  const { series, creator: user, orderType, rate, vol, broker } = doc;
  // if doesnt exist, create a new one
  if (!bidOfferUpdate) {
    const data = {
      series,
      user,
      broker,
    };

    if (orderType === "bid") {
      data.bid = rate;
      data.bid_vol = vol;
    }
    if (orderType === "offer") {
      data.offer = rate;
      data.offer_vol = vol;
    }

    console.log("data: ", data);

    const newBidOfferUpdate = await createPricesUpdate(data);
    console.log("newBidOfferUpdate: ", newBidOfferUpdate);
  } else {
    // else update the existing one
    console.log("orderType: ", orderType);

    const update = await Update.findById(bidOfferUpdate);

    if (orderType === "bid") {
      update.bid = rate;
      update.bid_vol = update.bid_vol === null ? vol : update.bid_vol + vol;
      const newUpdate = await update.save();
      console.log("newUpdate: ", newUpdate);
    }
    if (orderType === "offer") {
      update.offer = rate;
      update.offer_vol =
        update.offer_vol === null ? vol : update.offer_vol + vol;
      const newUpdate = await update.save();
      console.log("newUpdate: ", newUpdate);
    }
  }
});

// create middleware for deletion (should also take out volumes from price updates)

export default mongoose.model("Order", OrderSchema);
