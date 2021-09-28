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
  console.log("in getBestBidOffer");

  const result = {
    series: updateArray[0].series,
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

  // sort updateArray according to most recent

  console.log("updateArray: ", updateArray);

  // const updateArraySorted = updateArray.sort(
  //   (a, b) => a.created_at - b.created_at
  // );

  // console.log("updateArraySorted: ", updateArraySorted);

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
    const recentBidOfferUpdates = await Update.find({
      series,
      type: "bid_offer",
      // only pick up the ones created today
      created_at: { $gte: startOfToday },
    }).sort({ created_at: "desc" });

    console.log("recentBidOfferUpdates: ", recentBidOfferUpdates);

    if (recentBidOfferUpdates.length === 0) {
      return {
        series,
        bestBid: null,
        bestBidVols: [],
        bestBidBrokers: [],
        bestOffer: null,
        bestOfferVols: [],
        bestOfferBrokers: [],
      };
    }

    const bestBidOffer = getBestBidOffer(recentBidOfferUpdates);

    console.log("bestBidOffer: ", bestBidOffer);
    return bestBidOffer;
  } catch (err) {
    return Promise.reject(err);
  }
};
