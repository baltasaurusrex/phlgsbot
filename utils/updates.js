import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import Update from "../models/Update.js";

export const getDate = (dateInput) => {
  try {
    return dayjs(dateInput, ["MM/DD", "MM/DD/YY", "MM/DD/YYYY"]).format(
      "DD-MM-YYYY"
    );
  } catch (err) {
    return err;
  }
};

export const formatPrice = (price) => {
  try {
    // if no price is inputted, or price inputted is "na" or "/", means price is null
    const na_format = new RegExp(`na|\\/`, "i");
    if (!price || na_format.test(price)) {
      console.log("!price || na_format.test(price)");
      return null;
    }

    // else, check if price is formatted properly
    const proper_format = new RegExp(`^\\d*\\.?\\d*$`, "i");
    console.log("proper_format: ", proper_format);
    if (!proper_format.test(price)) {
      console.log("!proper_format.test(price)");
      throw new Error("Price not formatted properly");
    }

    // if it's formatted properly:
    // if price has a decimal
    const has_decimal = new RegExp(`\\.`, "i");
    if (has_decimal.test(price)) {
      const float = Number.parseFloat(price);
      const to_fixed = float.toFixed(3);
      return Number.parseFloat(to_fixed);
    } else {
      const decimal = price.slice(0, 1) + "." + price.slice(1);
      const float = Number.parseFloat(decimal);
      const to_fixed = float.toFixed(3);
      return Number.parseFloat(to_fixed);
    }
  } catch (err) {
    console.log("formatPrice err: ", err);
    return err;
  }
};

export const getBrokers = (string) => {
  // loop through the string
  try {
    let broker_array = [];

    console.log("in getBrokers");
    console.log("string: ", string);

    if (!string) {
      console.log("!string");
      broker_array.push("MOSB");
    } else {
      for (let i = 0; i < string.length; i++) {
        let char = string.charAt(i);
        broker_array.push(getBroker(char));
      }
    }

    return broker_array;
  } catch (err) {
    return err;
  }
};

export const getBroker = (code) => {
  if (!code) return "MOSB";

  const firstLetter = code.slice(0, 1);
  switch (firstLetter.toLowerCase()) {
    case "p":
      return "Prebon";
    case "a":
      return "Amstel";
    case "t":
      return "Tradition";
    case "g":
      return "GFI";
    default:
      return "MOSB";
  }
};

export const formatTime = (timeString, timePeriod) => {
  let formattedTimeString = timeString;
  if (timeString.length === 3) {
    const hour = timeString.slice(0, 1);
    const minutes = timeString.slice(1);

    if (hour <= 9 && hour >= 1) {
      formattedTimeString = "0" + hour + minutes;
    }
  }
  const before = formattedTimeString + timePeriod;

  const dayjsObj = dayjs(before, ["hhmma", "ha"]);

  console.log(dayjs(dayjsObj).format());
  return dayjs(dayjsObj).format();
};

export const getBestBidOffer = (updateArray) => {
  const result = {
    bestBid: null,
    bestBidVols: [],
    bestBidBrokers: [],
    bestOffer: null,
    bestOfferVols: [],
    bestOfferBrokers: [],
  };

  const arrayOfBids = updateArray
    .map((update) => {
      return update.bid;
    })
    .filter((bid) => bid !== null);

  result.bestBid = arrayOfBids.length > 0 ? Math.min(...arrayOfBids) : null;

  const arrayOfOffers = updateArray
    .map((update) => {
      return update.offer;
    })
    .filter((offer) => offer !== null);
  result.bestOffer =
    arrayOfOffers.length > 0 ? Math.max(...arrayOfOffers) : null;

  // listing the  brokers of the best bids and offers and their volumes
  updateArray.forEach((update) => {
    if (update.bid === result.bestBid) {
      // if broker already in the best(Bid|Offer)Brokers array, since the first one is assumed to be the most recent, don't include
      if (!result.bestBidBrokers.includes(update.broker)) {
        result.bestBidVols.push(update.bid_vol);
        result.bestBidBrokers.push(update.broker);
      }
    }
    if (update.offer === result.bestOffer) {
      // if broker already in the best(Bid|Offer)Brokers array, since the first one is assumed to be the most recent, don't include
      if (!result.bestOfferBrokers.includes(update.broker)) {
        result.bestOfferVols.push(update.offer_vol);
        result.bestOfferBrokers.push(update.broker);
      }
    }
  });

  return result;
};

export const getVWAP = (array) => {
  console.log("in getVWAP");

  let num = 0;
  let den = 0;

  let vwap = "no good vol";
  let totalVol = null;

  if (array.length === 0) return { vwap, totalVol };

  array.forEach((deal) => {
    num += deal.lastDealt * deal.lastDealtVol;
    den += deal.lastDealtVol;
  });

  vwap = (num / den).toFixed(3);
  totalVol = den.toFixed(2);

  return { vwap, totalVol };
};

// Only get's OHLC of good vol trades
export const getOHLC = (array_input) => {
  console.log("in getOHLC: ");
  let open = "no good vol";
  let high = "no good vol";
  let low = "no good vol";
  let close = "no good vol";

  const array = array_input.filter((el) => el.lastDealtVol >= 50);

  const getOpenClose = (array) => {
    const sorted = array.sort((a, b) => {
      return a.time - b.time;
    });
    return { open: sorted[0], close: sorted[sorted.length - 1] };
  };
  const getHighLow = (array) => {
    const sorted = array.sort((a, b) => {
      return b.lastDealt - a.lastDealt;
    });
    return { high: sorted[0], low: sorted[sorted.length - 1] };
  };

  if (array.length > 0) {
    open = getOpenClose(array).open.lastDealt.toFixed(3);
    close = getOpenClose(array).close.lastDealt.toFixed(3);
    high = getHighLow(array).high.lastDealt.toFixed(3);
    low = getHighLow(array).low.lastDealt.toFixed(3);
  }

  return { open, high, low, close };
};

export const getPrevGoodVol = async (series, starting_date) => {
  try {
    const prev_good_vol = await Update.findOne({
      series,
      type: "last_dealt",
      lastDealtVol: { $gte: 50 },
      time: {
        $lt: starting_date,
      },
    }).sort({ time: "desc" });

    return prev_good_vol;
  } catch (err) {
    return err;
  }
};

export const getPrevDayTrades = async (series, starting_date) => {
  // find the most recent good vol trade prior to the starting day
  console.log("in getPrevDayTrades: ");
  const prev_good_vol = await getPrevGoodVol(series, starting_date);

  let startOfDay = null;
  let endOfDay = null;

  // once found, use that trade's time to determine the start and end of that day
  if (prev_good_vol) {
    startOfDay = dayjs(prev_good_vol.time).startOf("day").toDate();
    endOfDay = dayjs(startOfDay).endOf("day").toDate();
  } else {
    return [];
  }

  // use the start and end of that day to get the trades of that day
  const all_deals = await Update.find({
    series,
    type: "last_dealt",
    time: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

  return all_deals;
};

export const getTotalVol = (array) => {
  try {
    if (!array) throw new Error("No array.");
    console.log("array[0]: ", array[0]);
    let sum = 0;
    for (const deal of array) {
      sum = sum + deal.lastDealtVol;
    }
    return sum.toFixed(2);
  } catch (err) {
    return err;
  }
};
