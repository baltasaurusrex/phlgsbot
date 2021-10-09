import Order from "../models/Order.js";

export const createOrder = async (details) => {
  try {
    console.log("details: ", details);
    const order = new Order({
      ...details,
    });

    const newOrder = await order.save();

    return newOrder;
  } catch (err) {
    return err;
  }
};

export const fetchOrders = async (series, desk, broker) => {
  try {
    const mongoQuery = {};
    series !== undefined ? (mongoQuery.series = series) : null;
    desk !== undefined ? (mongoQuery.desk = desk) : null;
    broker !== undefined ? (mongoQuery.broker = broker) : null;

    const orders = await Order.find(mongoQuery);

    return orders;
  } catch (err) {
    return err;
  }
};
