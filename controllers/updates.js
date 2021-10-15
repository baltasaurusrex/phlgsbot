import Update from "../models/Update.js";
import { getSeries } from "./isins.js";
import dayjs from "dayjs";

export const createPricesUpdate = async (data) => {
  try {
    const { series, user, bid, bid_vol, offer, offer_vol, broker } = data;

    console.log("user: ", user);

    const newUpdate = new Update({
      series,
      type: "bid_offer",
      creator: user,
      bid,
      bid_vol,
      offer,
      offer_vol,
      broker,
    });

    const savedUpdate = await newUpdate.save();

    return savedUpdate;
  } catch (err) {
    console.log("createPricesUpdate err: ", err);
    return err;
  }
};

export const createDealtUpdate = async (data) => {
  try {
    const { series, action, price, volume, broker, creator, time } = data;

    const newUpdate = new Update({
      type: "last_dealt",
      series,
      creator,
      direction: action,
      lastDealt: price,
      lastDealtVol: volume,
      time,
      broker,
    });

    const savedUpdate = await newUpdate.save();

    return savedUpdate;
  } catch (err) {
    console.log("createPricesUpdate err: ", err);
    return err;
  }
};

const getBestBidOffer = (updateArray) => {
  console.log("in getBestBidOffer: ", updateArray);

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
  console.log("arrayOfBids: ", arrayOfBids);
  result.bestBid = arrayOfBids.length > 0 ? Math.min(...arrayOfBids) : null;
  console.log("result.bestBid: ", result.bestBid);

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

export const fetchPricingData = async (series) => {
  console.log("in fetchPricingData: ", series);
  try {
    // find all bid offer updates related to that series

    const startOfToday = dayjs().startOf("day").toDate();

    const todaysBidOfferUpdates = await Update.find({
      series,
      type: "bid_offer",
      // only pick up the ones created today
      time: { $gte: startOfToday },
    }).sort({ time: "desc" });

    console.log("todaysBidOfferUpdates: ", todaysBidOfferUpdates);

    let mostRecentBidOfferUpdates = [];
    let currentBrokers = [];

    if (todaysBidOfferUpdates.length > 0) {
      todaysBidOfferUpdates.forEach((quote) => {
        // if broker already in the mostRecentBidOfferUpdates array, since the first one is assumed to be the most recent, don't include
        console.log("quote: ", quote);
        if (!currentBrokers.includes(quote.broker)) {
          console.log("!currentBrokers.includes(quote.broker)");
          mostRecentBidOfferUpdates.push(quote);
          currentBrokers.push(quote.broker);
        }
      });
      console.log("mostRecentBidOfferUpdates: ", mostRecentBidOfferUpdates);
    }

    const bestBidOffer = getBestBidOffer(mostRecentBidOfferUpdates);

    console.log("bestBidOffer: ", bestBidOffer);

    const lastDealt = await Update.find({
      series,
      type: "last_dealt",
      lastDealVol: { $gte: 50 },
      // only pick up the ones created today
      time: { $gte: startOfToday },
    }).sort({ time: "desc" });

    console.log("lastDealt[0]: ", lastDealt[0]);

    return {
      series,
      quotes: mostRecentBidOfferUpdates,
      bestBidOffer,
      lastDealt: lastDealt[0],
    };
  } catch (err) {
    return Promise.reject(err);
  }
};
