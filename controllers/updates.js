import Update from "../models/Update.js";
import { getSeries } from "./isins.js";

export const createPricesUpdate = async (data) => {
  try {
    const { series, user, bid, bidvol, offer, offervol, broker } = data;

    console.log("user: ", user);

    const newUpdate = new Update({
      series,
      type: "bid_offer",
      creator: user,
      bid,
      bid_vol: bidvol,
      offer,
      offer_vol: offervol,
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
    const { series, action, price, volume, broker, user } = data;

    const newUpdate = new Update({
      type: "last_dealt",
      series,
      creator: user,
      direction: action,
      lastDealt: price,
      lastDealtVol: volume,
      broker,
    });

    console.log("newUpdate: ", newUpdate);

    const savedUpdate = await newUpdate.save();

    console.log("savedUpdate: ", savedUpdate);

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

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todaysBidOfferUpdates = await Update.find({
      series,
      type: "bid_offer",
      // only pick up the ones created today
      created_at: { $gte: startOfToday },
    }).sort({ created_at: "desc" });

    console.log("todaysBidOfferUpdates: ", todaysBidOfferUpdates);

    if (todaysBidOfferUpdates.length === 0) {
      return {
        series,
        quotes: [],
      };
    }

    let mostRecentBidOfferUpdates = [];
    let currentBrokers = [];

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

    const bestBidOffer = getBestBidOffer(mostRecentBidOfferUpdates);

    console.log("bestBidOffer: ", bestBidOffer);

    return { series, quotes: mostRecentBidOfferUpdates, bestBidOffer };
  } catch (err) {
    return Promise.reject(err);
  }
};
