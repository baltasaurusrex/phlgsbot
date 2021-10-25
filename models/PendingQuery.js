import mongoose from "mongoose";

const PendingQuerySchema = mongoose.Schema({
  type: { type: String, required: true, enum: ["dealt_order"] },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  attachment: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "onModel",
  },
  onModel: {
    type: String,
    required: true,
    enum: ["Order"],
    default: function () {
      if (this.type === "dealt_order") return "Order";
    },
  },
  status: { type: String, enum: ["pending", "complete"], default: "pending" },
  time: { type: Date, default: Date.now },
});

export default mongoose.model("PendingQuery", PendingQuerySchema);
