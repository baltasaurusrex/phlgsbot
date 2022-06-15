import Update from "../models/Update.js";
import {
  getSeries,
  getAllIsins,
  getValidIsins,
  getTenor,
  getISINWithSeries,
} from "./isins.js";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import {
  getBestBidOffer,
  getVWAP,
  getOHLC,
  getPrevDayTrades,
  getPrevGoodVol,
  getPeriod,
} from "../utils/updates.js";
import { getArbitraryDatesRegex } from "../utils/regex.js";
import { getComparable } from "./isins.js";

export const createPricesUpdate = async (data, options) => {
  console.log("in createPricesUpdate controller");
  console.log("data: ", data);
  console.log("options: ", options);
  const settings = {
    nullIgnored: false,
  };

  console.log("typeof options: ", typeof options);
  if (options && typeof options === "object") {
    console.log(`options && typeof options === "object"`);
    if (Object.keys(options).includes("nullIgnored")) {
      console.log('Object.keys(options).includes("nullIgnored")');
      settings.nullIgnored = options.nullIgnored;
    }
  }
  try {
    const startOfToday = dayjs().startOf("day").toDate();

    let existingUpdate = await Update.findOne({
      type: "bid_offer",
      series: data.series,
      broker: data.broker,
      time: { $gte: startOfToday },
    });

    console.log("existingUpdate: ", existingUpdate);

    let savedUpdate = null;
    if (existingUpdate) {
      let obj = null;

      if (settings.nullIgnored) {
        obj = Object.fromEntries(
          Object.entries(data).filter(([_, v]) => v != null)
        );
      } else {
        obj = data;
      }

      existingUpdate = Object.assign(existingUpdate, obj);
      console.log("existingUpdate after Object.assign: ", existingUpdate);
      savedUpdate = await existingUpdate.save();
    } else {
      const { series, user, bid, bid_vol, offer, offer_vol, broker } = data;

      const isin = await getISINWithSeries(series);

      const newUpdate = new Update({
        series,
        isin,
        creator: user,
        type: "bid_offer",
        bid,
        bid_vol,
        offer,
        offer_vol,
        broker,
      });
      savedUpdate = await newUpdate.save();
    }

    console.log("savedUpdate: ", savedUpdate);
    return savedUpdate;
  } catch (err) {
    console.log("createPricesUpdate err: ", err);
    return err;
  }
};

export const createDealtUpdate = async (data) => {
  try {
    const {
      isin,
      series,
      action,
      price,
      volume: volInput,
      broker,
      creator,
      time,
    } = data;

    const volume = volInput ? Number.parseFloat(volInput) : 50;

    console.log(isin, series, price, volume);
    console.log(time);
    console.log(typeof time);

    const timeformatted = new Date(time);

    console.log(timeformatted);
    console.log(typeof timeformatted);

    const newUpdate = new Update({
      type: "last_dealt",
      isin,
      series,
      creator,
      direction: action,
      lastDealt: price,
      lastDealtVol: volume,
      time,
      broker,
    });

    const savedUpdate = await newUpdate.save();

    console.log("savedUpdate._doc: ", savedUpdate._doc);

    return savedUpdate._doc;
  } catch (err) {
    console.log("createPricesUpdate err: ", err);
    return err;
  }
};

// finds all bid offer updates related to that series
export const fetchPricingData = async (series) => {
  try {
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
    )?.time;

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

export const fetchHistoricalPrices = async (series_input, period_input) => {
  try {
    const series = await getSeries(series_input);
    const { start_date, end_date } = getPeriod(period_input);
    // validate the series
    if (!series) throw new Error("A series must be supplied.");
    // validate the period

    console.log("in fetchHistoricalPrices: ");
    console.log("series: ", series);
    console.log("start_date: ", start_date);
    console.log("end_date: ", end_date);
    // period should either be a keyword (last week, last 2 weeks, weekly, 2 weeks, monthly, etc.) or a range like "MM/DD-MM/DD", which will be auto formatted into a beg and end date object

    // array of dayObj's
    let array = [];

    // for period summary
    const all_trades = [];
    let summary = {};

    for (
      let pointer_date = end_date;
      pointer_date >= start_date;
      pointer_date = dayjs(pointer_date).subtract(1, "days").toDate()
    ) {
      console.log("end_date: ", end_date);
      console.log("pointer_date: ", pointer_date);
      console.log("start_date: ", start_date);
      const day_of_week = dayjs(pointer_date).format("ddd");
      const day_beg = dayjs(pointer_date).startOf("day").toDate();
      const day_end = dayjs(pointer_date).endOf("day").toDate();
      const is_weekend = ["Sun", "Sat"].includes(day_of_week);
      console.log("day_of_week: ", day_of_week);
      console.log("is_weekend: ", is_weekend);
      console.log("day_beg: ", day_beg);
      console.log("day_end: ", day_end);
      if (is_weekend) continue;

      let day_obj = { date: pointer_date, day: day_of_week };

      const pointer_date_deals = await Update.find({
        series,
        type: "last_dealt",
        time: {
          $gte: day_beg,
          $lte: day_end,
        },
      }).lean();

      const trades = pointer_date_deals.length;

      if (trades > 0) {
        all_trades.push(...pointer_date_deals);
        const { totalVol, vwap } = getVWAP(pointer_date_deals, {
          goodVolOnly: false,
        });
        const { open, high, low, close } = getOHLC(pointer_date_deals);

        day_obj = {
          ...day_obj,
          open,
          high,
          low,
          close,
          vwap,
          totalVol,
          trades,
        };
      } else {
        day_obj = {
          ...day_obj,
          trades,
        };
      }

      array.push(day_obj);
    }

    // adding D-o-D change objects to the dayObj's
    const array_with_change = await Promise.all(
      array.map(async (day_obj, i, array) => {
        let change = {
          close: null,
          vwap: null,
        };

        // if day_obj doesn't have a close or vwap
        if (
          isNaN(parseFloat(day_obj.close)) ||
          isNaN(parseFloat(day_obj.vwap))
        ) {
          return {
            ...day_obj,
            change,
          };
        }

        // if it does, then:

        // look for something that's already in the array by looping through it
        for (let j = i + 1; j < array.length; j++) {
          let prev_day_obj = array[j];
          // until you find an object where there is a close & a vwap
          if (
            isNaN(parseFloat(prev_day_obj.close)) ||
            isNaN(parseFloat(prev_day_obj.vwap))
          ) {
            // if prev_day_obj's close or vwap is "No good vol", then just skip
            continue;
          } else {
            // if prev_day_obj's close or vwap is a number, then calculate the change
            change = {
              close: (
                parseFloat(day_obj.close) - parseFloat(prev_day_obj.close)
              ).toFixed(4),
              vwap: (
                parseFloat(day_obj.vwap) - parseFloat(prev_day_obj.vwap)
              ).toFixed(4),
            };
            break;
          }
        }

        // if after that, it still has no change object, then just query it from mongodb
        if (day_obj.trades > 0 && !change.close && !change.vwap) {
          const start_date = dayjs(day_obj.date).startOf("day").toDate();
          const prev_day_deals = await getPrevDayTrades(series, start_date); // this is all vol (both good and bad)

          let { close } = getOHLC(prev_day_deals);
          let { vwap } = getVWAP(prev_day_deals, { goodVolOnly: false });
          let prev_close = parseFloat(close);
          let prev_vwap = parseFloat(vwap);

          change = {
            close: isNaN(prev_close)
              ? null
              : parseFloat(day_obj.close) - prev_close.toFixed(4),
            vwap: isNaN(prev_vwap)
              ? null
              : parseFloat(day_obj.vwap) - prev_vwap.toFixed(4),
          };
        }

        return {
          ...day_obj,
          change,
        };
      })
    );

    summary.trades = all_trades.length;
    summary.endOfPeriod = end_date;
    summary.startOfPeriod = start_date;

    if (all_trades.length > 0) {
      summary.vwap = getVWAP(all_trades, { goodVolOnly: false })?.vwap;
      summary.totalVol = getVWAP(all_trades, { goodVolOnly: false })?.totalVol;
      summary.open = getOHLC(all_trades).open;
      summary.high = getOHLC(all_trades).high;
      summary.low = getOHLC(all_trades).low;
      summary.close = getOHLC(all_trades).close;

      const prev_day_trades = await getPrevDayTrades(series, start_date);
      // const good_vol = prev_day_trades.filter((el) => el.lastDealtVol >= 50);
      const { vwap: vwap_prev } = getVWAP(prev_day_trades, {
        goodVolOnly: false,
      });
      const { close: close_prev } = getOHLC(prev_day_trades);

      console.log("summary.close: ", summary.close);
      console.log("close_prev: ", close_prev);

      const change = {
        close: (parseFloat(summary.close) - parseFloat(close_prev)).toFixed(4),
        vwap: (parseFloat(summary.vwap) - parseFloat(vwap_prev)).toFixed(4),
      };
      summary.change = change;
    }

    const date_input = dayjs(end_date).format("MM/DD/YYYY");
    summary.tenor = await getTenor(series, date_input);
    console.log("summary: ", summary);
    return { array: array_with_change, summary };
  } catch (err) {
    return err;
  }
};

// period should be MM/DD/YYYY
export const fetchTrades = async (isin, period) => {
  try {
    // check if isin is valid (?) might take too long
    const validIsins = await getValidIsins();
    if (!validIsins.includes(isin)) throw new Error("Not a valid ISIN.");

    if (!period)
      throw new Error(
        "Period must be supplied. Pass a date object, or a range using this format: MM/DD/YY[YY]-MM/DD/YY[YY]"
      );

    const regex = getArbitraryDatesRegex();
    if (!period.match(regex) && period instanceof Date === false)
      throw new Error(
        "Proper period must be supplied. Please pass a date object, or a range using this format: MM/DD/YY[YY]-MM/DD/YY[YY]"
      );

    let start_date = null;
    let end_date = null;

    let { start_date: start, end_date: end } = getPeriod(period);
    start_date = start;
    end_date = end;

    let mongoQuery = { isin, type: "last_dealt" };

    // only if getPeriod returns a start_date and end_date
    // if not (i.e. if period = "all"), dont put time filter, let it just fetch all
    if (start_date && end_date)
      mongoQuery.time = { $gte: start_date, $lte: end_date };

    let trades = [];

    trades = await Update.find(mongoQuery).lean();

    // this sorts the trades starting from the most recent
    trades = trades.sort((a, b) => {
      return b.time - a.time;
    });

    return trades;
  } catch (err) {
    return err.message;
  }
};

export const fetchTimeAndSales = async (period_input, series_input) => {
  try {
    const series = await getSeries(series_input);

    // validate the period
    console.log("in fetchTimeAndSales: ");
    console.log("series: ", series);

    let date = null;

    // if no period was supplied, just use the current day, or if on a weekend, the latest friday
    if (!period_input) {
      const day_of_week = dayjs().format("ddd");
      const is_weekend = ["Sun", "Sat"].includes(day_of_week);
      if (is_weekend) {
        // if date lies on a weekend, get the most recent weekday instead
        date = dayjs().day(5).startOf("day").toDate();
      } else {
        // else just get the current date
        date = dayjs().toDate();
      }
    } else {
      date = dayjs(period_input, ["MM/DD/YYYY", "MM/DD/YY", "MM/DD"]).toDate();
    }

    console.log("date: ", date);

    const day_beg = dayjs(date).startOf("day").toDate();
    const day_end = dayjs(date).endOf("day").toDate();

    let summary = {};
    let array = [];

    if (!series) {
      console.log("!series");
      const mongoQuery = {
        type: "last_dealt",
        time: { $gte: day_beg, $lte: day_end },
      };

      const unsorted = await Update.find(mongoQuery);

      // this sorts the trades starting from the most recent
      array = unsorted.sort((a, b) => {
        return b.time - a.time;
      });

      console.log("array.length: ", array.length);

      summary.trades = array.length;

      console.log("array[0]: ", array[0]);
      summary.totalVol = getVWAP(array, { goodVolOnly: false })?.totalVol;
    } else {
      // if a series was supplied
      const mongoQuery = {
        series,
        type: "last_dealt",
        time: { $gte: day_beg, $lte: day_end },
      };

      const unsorted = await Update.find(mongoQuery);

      array = unsorted.sort((a, b) => {
        return b.time - a.time;
      });

      summary.trades = array.length;

      const goodVolTrades = array.filter((el) => el.lastDealtVol >= 50);

      if (summary.trades > 0) {
        summary.vwap = getVWAP(array, { goodVolOnly: false })?.vwap; //
        summary.totalVol = getVWAP(array, { goodVolOnly: false })?.totalVol; //include all
        const { open, high, low, close } = getOHLC(array); //only get the good vols for OHLC
        summary.open = open;
        summary.high = high;
        summary.low = low;
        summary.close = close;
      }

      const prev_day_trades = await getPrevDayTrades(series, day_beg);

      if (goodVolTrades.length > 0 && prev_day_trades.length > 0) {
        // const good_vol = prev_day_trades.filter((el) => el.lastDealtVol >= 50);
        const { vwap, totalVol } = getVWAP(prev_day_trades);
        const { open, high, low, close } = getOHLC(prev_day_trades);
        console.log("summary.vwap: ", summary.vwap);
        console.log("prev vwap: ", vwap);
        console.log("summary.close: ", summary.close);
        console.log("prev close: ", close);
        const change = {
          close: (parseFloat(summary.close) - parseFloat(close)).toFixed(4),
          vwap: (parseFloat(summary.vwap) - parseFloat(vwap)).toFixed(4),
        };

        summary.change = { ...change };
      }
    }

    console.log("array: ", array);
    console.log("summary: ", summary);

    return { array, summary };
  } catch (err) {
    return err;
  }
};

export const fetchSummary = async (period) => {
  console.log("in fetchSummary: ");
  console.log("period: ", period);
  const isins = await getAllIsins({ watchlist_only: true });
  const series_array = isins.map((isin) => isin.series);
  let array = [];
  let summary = { totalVol: 0, trades: 0 };

  array = await Promise.all(
    series_array.map(async (series) => {
      console.log("series: ", series);
      const { summary } = await fetchHistoricalPrices(series, period);
      return {
        series,
        summary,
      };
    })
  );

  const { start_date, end_date } = getPeriod(period);

  // GET LAST TRADED DATE FOR THOSE WITHOUT TRADES
  array = await Promise.all(
    array.map(async (obj) => {
      const { series, summary } = obj;
      // if it has > 0 trades, that means it's complete, in which case, just return it
      if (summary.trades > 0) return obj;
      // if not, this code will run, and you have to fill in the summary with the most recent trades data
      // get the trades from the most recent day with a good vol trade
      const prev_good_vol = await getPrevGoodVol(series, end_date);
      console.log(prev_good_vol);
      if (prev_good_vol) {
        const date_input = dayjs(prev_good_vol.time).format("MM/DD/YYYY");
        console.log("date_input: ", date_input);
        let { summary: prev_summary } = await fetchTimeAndSales(
          date_input,
          series
        );
        prev_summary.date = date_input;
        console.log("prev_summary: ", prev_summary);
        return { series, summary, prev_summary };
      } else {
        return obj;
      }
    })
  );

  // add spreads
  // const comparable_security = getComparable();

  // const getSpread = (subj_series, ref_series) => {
  //   return subj_series.summary.tenor - ref_series.summary.tenor;
  // };

  // array = await Promise.all(
  //   array.map(async (obj, i, arr) => {
  //     // if first, no spread, just return it as is
  //     if (i === 0) return obj;

  //     const summary = obj.summary;

  //     summary.spread = getSpread(obj, arr[i - 1]);

  //     return { ...obj, summary };
  //   })
  // );

  // fill summary {totalVol, trades}

  for (
    let pointer_date = end_date;
    pointer_date >= start_date;
    pointer_date = dayjs(pointer_date).subtract(1, "days").toDate()
  ) {
    console.log("end_date: ", end_date);
    console.log("pointer_date: ", pointer_date);
    console.log("start_date: ", start_date);
    const day_of_week = dayjs(pointer_date).format("ddd");
    const day_end = dayjs(pointer_date).endOf("day").toDate();
    const is_weekend = ["Sun", "Sat"].includes(day_of_week);
    console.log("day_of_week: ", day_of_week);
    console.log("is_weekend: ", is_weekend);
    console.log("day_end: ", day_end);
    if (is_weekend) continue;

    const date = dayjs(pointer_date).format("MM/DD/YYYY");

    const { summary: day_summary } = await fetchTimeAndSales(date);

    summary.totalVol += day_summary.totalVol
      ? parseFloat(day_summary.totalVol)
      : 0;
    summary.trades += day_summary.trades ? parseFloat(day_summary.trades) : 0;
  }

  summary.totalVol = summary.totalVol.toFixed(2);

  return { period, array, summary };
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

export const getAllTradeDates = async (isin) => {
  try {
    const validIsins = await getValidIsins();
    if (!validIsins.includes(isin)) throw new Error("Not a valid ISIN.");

    const allTrades = await Update.find({ isin, type: "last_dealt" });

    let dates = [];
    let utc_dates = [];

    allTrades.forEach((trade) => {
      const date = dayjs(trade.time).format("MM/DD/YYYY");
      // const utc_date = dayjs(trade.time).startOf("day").toDate();
      if (!dates.includes(date)) {
        dates.push(date);
        // utc_dates.push(utc_date);
      }
      return;
    });

    let sorted = dates.sort((a, b) => {
      let first = dayjs(a, ["MM/DD/YYYY"]).valueOf();
      let second = dayjs(b, ["MM/DD/YYYY"]).valueOf();
      return first - second;
    });

    return sorted;
  } catch (err) {
    return err;
  }
};
