export const renderOrder = (order) => {
  console.log("in renderOrder");
  console.log("order: ", order);
  const { series, orderType, rate, vol, filledVol, broker, forDesk } = order;
  return `${series} ${orderType} ${rate} for ${
    vol - filledVol
  } on ${broker} | ${forDesk}\n`;
};
