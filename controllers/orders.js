import Order from "../models/Order.js";
import dayjs from "dayjs";

export const createOrder = async (details) => {
  try {
    console.log("details: ", details);
    const { forDesk, broker, series, orderType } = details;

    // check if there is an existing order of that isin on that broker
    // if there is, just update that order
    let existingOrder = await Order.findOne({
      forDesk,
      orderType,
      broker,
      series,
    });

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

export const offOrders = async (series, desk, broker) => {
  const startOfToday = dayjs().startOf("day").toDate();
  try {
    const mongoQuery = {
      status: "active",
      time: { $gte: startOfToday },
    };
    series !== undefined ? (mongoQuery.series = `/${series}/i`) : null;
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
export const fetchOrders = async (series, desk, broker) => {
  const startOfToday = dayjs().startOf("day").toDate();
  try {
    const mongoQuery = {
      status: "active",
      time: { $gte: startOfToday },
    };
    series !== undefined ? (mongoQuery.series = `/${series}/i`) : null;
    desk !== undefined
      ? (mongoQuery.forDesk = { $regex: `${desk}`, $options: "gi" })
      : null;
    broker !== undefined ? (mongoQuery.broker = broker) : null;

    console.log("mongoQuery: ", mongoQuery);
    const orders = await Order.find(mongoQuery);

    return orders;
  } catch (err) {
    return err;
  }
};
