export const renderOrder = (order) => {
  console.log("in renderOrder");
  console.log("order: ", order);
  const { series, orderType, rate, vol, broker, forDesk } = order;
  return `${series} ${orderType} ${rate} for ${vol} on ${broker} | ${forDesk}\n`;
};
