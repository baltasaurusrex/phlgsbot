import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import Update from "../models/Update.js";

export const formatPrice = (price) => {
  console.log("price: ", price);
  const regex = new RegExp(`na|\\/`, "i");
  if (regex.test(price)) return null;
  const decimal = price.slice(0, 1) + "." + price.slice(1);

  const float = Number.parseFloat(decimal);

  const precise = Number.parseFloat(float.toPrecision(4));

  return precise;
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

export const getOHLC = (array) => {
  console.log("in getOHLC");
  let open = "no good vol";
  let high = "no good vol";
  let low = "no good vol";
  let close = "no good vol";

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

export const getPrevDayTrades = async (series, startingDate) => {
  // find the most recent day
  console.log("in getPrevDayTrades");
  const mostRecentPrev = await Update.findOne({
    series,
    type: "last_dealt",
    lastDealtVol: { $gte: 50 },
    time: {
      $lt: startingDate,
    },
  }).sort({ time: "desc" });

  let startOfDay = null;
  let endOfDay = null;

  console.log("mostRecentPrev: ", mostRecentPrev);

  if (mostRecentPrev) {
    startOfDay = dayjs(mostRecentPrev.time).startOf("day").toDate();
    console.log("startOfDay: ", startOfDay);
    endOfDay = dayjs(startOfDay).add(1, "day").toDate();
    console.log("endOfDay: ", endOfDay);
  } else {
    return [];
  }

  // get the trades of that day
  const prevDayDeals = await Update.find({
    series,
    type: "last_dealt",
    lastDealtVol: { $gte: 50 },
    time: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
  });

  return prevDayDeals;
};
