import Update from "../models/Update.js";
import { getSeries } from "./isins.js";
import dayjs from "dayjs";
import { getBestBidOffer, getVWAP, getOHLC } from "../utils/updates.js";

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

export const fetchPricingData = async (series) => {
  try {
    // find all bid offer updates related to that series

    const startOfToday = dayjs().startOf("day").toDate();
    console.log("startOfToday: ", startOfToday);

    const todaysBidOfferUpdates = await Update.find({
      series,
      type: "bid_offer",
      // only pick up the ones created today
      time: { $gte: startOfToday },
    }).sort({ time: "desc" });

    let mostRecentBidOfferUpdates = [];
    let currentBrokers = [];

    if (todaysBidOfferUpdates.length > 0) {
      todaysBidOfferUpdates.forEach((quote) => {
        // if broker already in the mostRecentBidOfferUpdates array, since the first one is assumed to be the most recent, don't include

        if (!currentBrokers.includes(quote.broker)) {
          mostRecentBidOfferUpdates.push(quote);
          currentBrokers.push(quote.broker);
        }
      });
    }

    const bestBidOffer = getBestBidOffer(mostRecentBidOfferUpdates);

    const mostRecentDate = (
      await Update.findOne({
        series,
        type: "last_dealt",
        lastDealtVol: { $gte: 50 },
      }).sort({ time: "desc" })
    ).time;

    console.log("mostRecentDate: ", mostRecentDate);

    const startOfMostRecentDate = dayjs(mostRecentDate).startOf("day").toDate();
    console.log("startOfMostRecentDate: ", startOfMostRecentDate);

    const dealtToday = await Update.find({
      series,
      type: "last_dealt",
      lastDealtVol: { $gte: 50 },
      // only pick up the ones created today
      time: { $gte: startOfMostRecentDate },
    }).sort({ time: "desc" });

    const lastDealt = dealtToday[0];

    const { vwap, totalVol } = getVWAP(dealtToday);

    const prevLastDealt = await Update.findOne({
      series,
      type: "last_dealt",
      lastDealtVol: { $gte: 50 },
      // only pick up the ones created today
      time: { $lt: startOfMostRecentDate },
    }).sort({ time: "desc" });

    return {
      series,
      quotes: mostRecentBidOfferUpdates,
      bestBidOffer,
      lastDealt,
      prevLastDealt,
      vwap,
      totalVol,
    };
  } catch (err) {
    return Promise.reject(err);
  }
};

export const fetchHistoricalPrices = async (series, period) => {
  try {
    // get series of days
    // if weekly, get the past 7 days, excluding weekends
    const array = [];
    if (period === "weekly") {
      const startOfToday = dayjs().startOf("day").toDate();

      for (let daysAgo = 0; daysAgo <= 7; daysAgo++) {
        const date = dayjs(startOfToday).subtract(daysAgo, "days").toDate();

        const daysEnd = dayjs(startOfToday)
          .subtract(daysAgo - 1, "days")
          .toDate();

        const dayOfTheWeek = dayjs(date).day();

        const weekend = [0, 6].includes(dayOfTheWeek);

        if (!weekend) {
          const dealsThatDay = await Update.find({
            series,
            type: "last_dealt",
            lastDealtVol: { $gte: 50 },
            time: {
              $gte: date,
              $lt: daysEnd,
            },
          });
          const trades = dealsThatDay.length;

          let dayObj = { date, day: dayOfTheWeek };

          if (trades > 0) {
            const { vwap, totalVol } = getVWAP(dealsThatDay);
            const { open, high, low, close } = getOHLC(dealsThatDay);

            dayObj = {
              ...dayObj,
              open,
              high,
              low,
              close,
              vwap,
              totalVol,
              trades,
            };
          } else {
            dayObj = {
              ...dayObj,
              trades,
            };
          }

          console.log("dayObj: ", dayObj);

          array.push(dayObj);
        }
      }
    } else if (period === "2 weeks") {
      const startOfToday = dayjs().startOf("day").toDate();

      for (let daysAgo = 0; daysAgo <= 14; daysAgo++) {
        const date = dayjs(startOfToday).subtract(daysAgo, "days").toDate();

        const daysEnd = dayjs(startOfToday)
          .subtract(daysAgo - 1, "days")
          .toDate();

        const dayOfTheWeek = dayjs(date).day();

        const weekend = [0, 6].includes(dayOfTheWeek);

        if (!weekend) {
          const dealsThatDay = await Update.find({
            series,
            type: "last_dealt",
            lastDealtVol: { $gte: 50 },
            time: {
              $gte: date,
              $lt: daysEnd,
            },
          });
          const trades = dealsThatDay.length;

          let dayObj = { date, day: dayOfTheWeek };

          if (trades > 0) {
            const { vwap, totalVol } = getVWAP(dealsThatDay);
            const { open, high, low, close } = getOHLC(dealsThatDay);

            dayObj = {
              ...dayObj,
              open,
              high,
              low,
              close,
              vwap,
              totalVol,
              trades,
            };
          } else {
            dayObj = {
              ...dayObj,
              trades,
            };
          }

          console.log("dayObj: ", dayObj);

          array.push(dayObj);
        }
      }
    }

    return array;
    // return a sorted array of objects {date, vwap, vol, lastDealt} representing each day
  } catch (err) {
    return err;
  }
};
