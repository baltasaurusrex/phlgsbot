import Update from "../models/Update.js";
import { getSeries, getAllIsins } from "./isins.js";
import dayjs from "dayjs";
import {
  getBestBidOffer,
  getVWAP,
  getOHLC,
  getPrevDayTrades,
} from "../utils/updates.js";

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
    console.log("in fetchHistoricalPrices");

    // array of dayObj's
    let array = [];

    // for period summary
    const allTrades = [];
    let summary = {};

    const startOfToday = dayjs().startOf("day").toDate();

    let daysLimit = null;

    if (["weekly", "1 week"].includes(period)) {
      daysLimit = 7;
    } else if (period === "2 weeks") {
      daysLimit = 14;
    } else if (["1 month", "monthly"].includes(period)) {
      daysLimit = 30;
    }

    const endOfPeriod = dayjs().startOf("day").toDate();
    const startOfPeriod = dayjs(endOfPeriod)
      .subtract(daysLimit, "days")
      .toDate();

    // create first run of dayObj's (OHLC, vwap, totalVol, trades)
    for (let daysAgo = 0; daysAgo <= daysLimit; daysAgo++) {
      const date = dayjs(startOfToday).subtract(daysAgo, "days").toDate();

      const dayOfTheWeek = dayjs(date).day();

      const daysEnd = dayjs(startOfToday)
        .subtract(daysAgo - 1, "days")
        .toDate();

      const weekend = [0, 6].includes(dayOfTheWeek);

      let dayObj = { date, day: dayOfTheWeek };

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

        console.log("date: ", date);
        console.log("daysEnd: ", daysEnd);

        const trades = dealsThatDay.length;

        if (trades > 0) {
          allTrades.push(...dealsThatDay);
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

    console.log("start mapping to new arrayWithChange");
    const arrayWithChange = await Promise.all(
      array.map(async (dayObj, i, array) => {
        let change = {
          close: null,
          vwap: null,
        };
        console.log("dayObj, beg: ", dayObj);

        // loop through the rest until you find an element with trades > 0
        for (let j = i + 1; j < array.length; j++) {
          let prevDayObj = array[j];
          if (prevDayObj.trades > 0) {
            change = {
              close: (
                parseFloat(dayObj.close) - parseFloat(prevDayObj.close)
              ).toFixed(4),
              vwap: (
                parseFloat(dayObj.vwap) - parseFloat(prevDayObj.vwap)
              ).toFixed(4),
            };
            break;
          } else {
            continue;
          }
        }

        // if after that, it still has no change object, then:
        if (dayObj.trades > 0 && !change.close && !change.vwap) {
          const startDate = dayjs(dayObj.date).startOf("day").toDate();
          const prevDayDeals = await getPrevDayTrades(series, startDate);

          const { vwap } = getVWAP(prevDayDeals);
          const { close } = getOHLC(prevDayDeals);
          change = {
            close: (parseFloat(dayObj.close) - parseFloat(close)).toFixed(4),
            vwap: (parseFloat(dayObj.vwap) - parseFloat(vwap)).toFixed(4),
          };
        }

        console.log("dayObj, end: ", { ...dayObj, change });

        return {
          ...dayObj,
          change,
        };
      })
    );

    summary.trades = allTrades.length;
    summary.endOfPeriod = endOfPeriod;
    summary.startOfPeriod = startOfPeriod;

    if (allTrades.length > 0) {
      summary.vwap = getVWAP(allTrades).vwap;
      summary.totalVol = getVWAP(allTrades).totalVol;
      summary.open = getOHLC(allTrades).open;
      summary.high = getOHLC(allTrades).high;
      summary.low = getOHLC(allTrades).low;
      summary.close = getOHLC(allTrades).close;
    }

    console.log("arrayWithChange: ", arrayWithChange);
    console.log("summary: ", summary);

    return { array: arrayWithChange, summary };
    // return a sorted array of objects {date, daym OHLC, vwap, totalVol, trades, change} representing each day + the summary for that period
  } catch (err) {
    return err;
  }
};

// Gets the most recent time and sales of that series for most recent trading day
export const fetchTimeAndSales = async (series, period) => {
  try {
    console.log("in fetchTimeAndSales: ");

    let date = null;

    console.log("period: ", period);
    if (period) {
      date = dayjs(period, "MM/DD").toDate();
    } else {
      date = dayjs().toDate();
    }
    console.log("date: ", date);

    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).add(1, "day");
    console.log("startOfDay: ", startOfDay);
    console.log("endOfDay: ", endOfDay);

    const mongoQuery = {
      series,
      type: "last_dealt",
      time: { $gte: startOfDay, $lt: endOfDay },
    };

    const unsorted = await Update.find(mongoQuery);

    const array = unsorted.sort((a, b) => {
      return b.time - a.time;
    });

    console.log("array.length: ", array.length);

    let summary = {};

    summary.trades = array.length;

    if (array.length > 0) {
      const goodVolTrades = array.filter((el) => el.lastDealtVol >= 50);
      const { vwap, totalVol } = getVWAP(goodVolTrades);
      summary.vwap = vwap;
      summary.totalVol = totalVol;
      const { open, high, low, close } = getOHLC(goodVolTrades);
      summary.open = open;
      summary.high = high;
      summary.low = low;
      summary.close = close;
    }

    console.log("summary: ", summary);

    const prevDayTrades = await getPrevDayTrades(series, startOfDay);

    console.log("prevDayTrades.length: ", prevDayTrades.length);

    if (summary.trades > 0 && prevDayTrades.length > 0) {
      const prevDayTrades_goodVol = prevDayTrades.filter(
        (el) => el.lastDealtVol >= 50
      );
      const { vwap, totalVol } = getVWAP(prevDayTrades_goodVol);
      const { open, high, low, close } = getOHLC(prevDayTrades_goodVol);
      console.log("summary.vwap: ", summary.vwap);
      console.log("prev vwap: ", vwap);
      console.log("summary.close: ", summary.close);
      console.log("prev close: ", close);
      const change = {
        close: (parseFloat(summary.close) - parseFloat(close)).toFixed(4),
        vwap: (parseFloat(summary.vwap) - parseFloat(vwap)).toFixed(4),
      };
      console.log("change: ", change);
      summary.change = { ...change };
    }

    return { array, summary };
  } catch (err) {
    return err;
  }
};

export const fetchSummary = async (day) => {
  console.log("in fetchSummary");
  const isins = await getAllIsins();
  const series = isins.map((isin) => isin.series);
  console.log("isins: ", isins);
  return isins;
};

export const deleteLastDealts = async (date) => {
  try {
    console.log("in deleteLastDealts");
    if (!date) return "no date supplied";

    const startOfDay = dayjs(date).startOf("day").toDate();
    console.log("startOfDay: ", startOfDay);

    const endOfDay = dayjs(startOfDay).add(1, "days").toDate();
    console.log("endOfDay: ", endOfDay);

    const deleted = await Update.deleteMany({
      type: "last_dealt",
      time: { $gte: startOfDay, $lt: endOfDay },
    });

    return deleted;
  } catch (err) {
    return err;
  }
};
