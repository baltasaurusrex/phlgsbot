import Order from "../models/Order.js";
import dayjs from "dayjs";
import { dealerSpiel } from "../utils/spiel.js";

export const createOrder = async (details) => {
  try {
    console.log("details: ", details);
    const { forDesk, broker, series, orderType } = details;

    // check if there is an existing order of that isin on that broker
    // if there is, just update that order
    let existingOrder = await Order.findOne({
      ...details,
      status: "active",
    });

    console.log("existingOrder: ", existingOrder);

    if (existingOrder) {
      // update existing order
      existingOrder = {
        ...details,
      };

      const updatedOrder = await existingOrder.save();
      // then return that updated order
      return updatedOrder;
    } else {
      // else, make a brand new order

      const order = new Order({
        ...details,
      });

      const newOrder = await order.save();

      return newOrder;
    }
  } catch (err) {
    return err;
  }
};

export const fetchOrders = async (series, rate, desk, broker) => {
  console.log("in fetchOrders");
  console.log("series: ", series);
  console.log("rate: ", rate);
  console.log("desk: ", desk);
  console.log("broker: ", broker);

  const startOfToday = dayjs().startOf("day").toDate();
  try {
    const mongoQuery = {
      status: "active",
      time: { $gte: startOfToday },
    };

    rate ? (mongoQuery.rate = rate) : null;
    series
      ? (mongoQuery.series = { $regex: `${series}`, $options: "gi" })
      : null;
    desk ? (mongoQuery.forDesk = { $regex: `${desk}`, $options: "gi" }) : null;
    broker ? (mongoQuery.broker = broker) : null;

    console.log("mongoQuery: ", mongoQuery);
    const orders = await Order.find(mongoQuery);

    return orders;
  } catch (err) {
    return err;
  }
};

export const fillOrder = async (order, volInput) => {
  try {
    console.log("in fillOrder");
    console.log("order: ", order);

    const filledVol = volInput ? Math.abs(volInput) : Math.abs(order.vol);
    const doc = await Order.findById(order);
    console.log("doc before: ", doc);

    if (!volInput) {
      console.log("!volInput -> doc.filledVol = doc.vol");
      doc.filledVol = doc.vol;
      console.log("doc.status = dealt");
      doc.status = "dealt";
    } else {
      console.log("has indicated vol");
      console.log("doc.filledVol = doc.filledVol + filledVol");
      doc.filledVol = doc.filledVol + filledVol;
    }

    console.log("doc after: ", doc);

    if (doc.vol === doc.filledVol) {
      console.log("doc.vol === doc.filledVol");
      console.log("doc.status = dealt");
      doc.status = "dealt";
    }

    const update = await doc.save();

    console.log("update: ", update);

    return update;
  } catch (err) {
    return err;
  }
};

export const offOrders = async (series, rate, desk, broker) => {
  const startOfToday = dayjs().startOf("day").toDate();
  try {
    const mongoQuery = {
      status: "active",
      time: { $gte: startOfToday },
    };
    rate !== undefined ? (mongoQuery.rate = rate) : null;
    series !== undefined
      ? (mongoQuery.series = { $regex: `${series}`, $options: "gi" })
      : null;
    desk !== undefined
      ? (mongoQuery.forDesk = { $regex: `${desk}`, $options: "gi" })
      : null;
    broker !== undefined ? (mongoQuery.broker = broker) : null;

    console.log("mongoQuery: ", mongoQuery);
    const ordersFound = await Order.find(mongoQuery);
    const ordersDeleted = await Order.deleteMany(mongoQuery);

    return { ordersFound, ordersDeleted };
  } catch (err) {
    return err;
  }
};
