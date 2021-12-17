import Update from "../models/Update.js";
import { getSeries, getAllIsins, getTenor } from "./isins.js";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import {
  getBestBidOffer,
  getVWAP,
  getOHLC,
  getPrevDayTrades,
  getPrevGoodVol,
} from "../utils/updates.js";
import { getArbitraryDatesRegex } from "../utils/regex.js";

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
      series,
      action,
      price,
      volume: volInput,
      broker,
      creator,
      time,
    } = data;

    const volume = volInput ? Number.parseFloat(volInput) : 50;

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

export const validate_period = async (period) => {
  try {
    if (!period) throw new Error("No period was supplied.");
  } catch (err) {
    return err;
  }
};

export const getPeriod = (period) => {
  console.log("in getPeriod: ");
  try {
    const regex = getArbitraryDatesRegex();

    let today = dayjs().toDate();
    let end_date = null;
    let start_date = null;

    // if there is no period given
    if (!period) {
      // get today's date
      const day_of_week = dayjs().format("ddd");
      const is_weekend = ["Sun", "Sat"].includes(day_of_week);
      // if today is a weekend, get the most recent weekday instead
      if (is_weekend) {
        end_date = dayjs().day(5).startOf("day").toDate();
        start_date = dayjs().day(5).startOf("day").toDate();
      } else {
        end_date = dayjs(today).startOf("day").toDate();
        start_date = dayjs(today).startOf("day").toDate();
      }
    } else if (period.match(regex)) {
      // if there is a period given which matches the arbitrary dates regex
      const [full, beg, end] = period.match(regex);

      // get the date format of the beg and end
      const beg_date_input = dayjs(beg, [
        "MM/DD/YYYY",
        "MM/DD/YY",
        "MM/DD",
      ]).toDate();

      // if there is no "end" date in the arbitrary dates regex

      if (!end) {
        // means just a solo date
        // get the start and end of that date
        end_date = beg_date_input;
        start_date = beg_date_input;
      } else {
        // get the start of the beg date, and the end of the end date
        start_date = beg_date_input;

        const end_date_input = dayjs(end, [
          "MM/DD/YYYY",
          "MM/DD/YY",
          "MM/DD",
        ]).toDate();

        // check if error in dates
        if (beg_date_input > end_date_input)
          throw new Error(
            `Start date should precede end date. Your input was: ${period}`
          );
        end_date = end_date_input;
      }
    } else {
      // If not using the arbitrary dates format
      end_date = dayjs(today).startOf("day").toDate();
      if (["last week", "last 2 weeks"].includes(period)) {
        let sunday = dayjs().day(0).startOf("day").toDate();
        end_date = dayjs(sunday).subtract(2, "days").toDate();
        if (period === "last week")
          start_date = dayjs(end_date).subtract(4, "days").toDate();
        if (period === "last 2 weeks")
          start_date = dayjs(end_date)
            .subtract(4 + 7, "days")
            .toDate();
      } else if (["weekly", "1 week"].includes(period)) {
        start_date = dayjs(end_date).subtract(7, "days").toDate();
      } else if (period === "2 weeks") {
        start_date = dayjs(end_date).subtract(14, "days").toDate();
      } else if (["1 month", "monthly"].includes(period)) {
        start_date = dayjs(end_date).subtract(30, "days").toDate();
      } else {
        end_date = dayjs(today).startOf("day").toDate();
      }
    }

    return { start_date, end_date };
  } catch (e) {
    return e;
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
      const day_end = dayjs(pointer_date).endOf("day").toDate();
      const is_weekend = ["Sun", "Sat"].includes(day_of_week);
      console.log("day_of_week: ", day_of_week);
      console.log("is_weekend: ", is_weekend);
      console.log("day_end: ", day_end);
      if (is_weekend) continue;

      let day_obj = { date: pointer_date, day: day_of_week };

      const pointer_date_deals = await Update.find({
        series,
        type: "last_dealt",
        lastDealtVol: { $gte: 50 },
        time: {
          $gte: pointer_date,
          $lte: day_end,
        },
      });

      const trades = pointer_date_deals.length;

      if (trades > 0) {
        all_trades.push(...pointer_date_deals);
        const { vwap, totalVol } = getVWAP(pointer_date_deals);
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

        // loop through the rest until you find an element with trades > 0
        for (let j = i + 1; j < array.length; j++) {
          let prev_day_obj = array[j];
          if (prev_day_obj.trades > 0) {
            change = {
              close: (
                parseFloat(day_obj.close) - parseFloat(prev_day_obj.close)
              ).toFixed(4),
              vwap: (
                parseFloat(day_obj.vwap) - parseFloat(prev_day_obj.vwap)
              ).toFixed(4),
            };
            break;
          } else {
            continue;
          }
        }

        // if after that, it still has no change object, then just query it from mongodb
        if (day_obj.trades > 0 && !change.close && !change.vwap) {
          const start_date = dayjs(day_obj.date).startOf("day").toDate();
          const prev_day_deals = await getPrevDayTrades(series, start_date);

          const { vwap } = getVWAP(prev_day_deals);
          const { close } = getOHLC(prev_day_deals);
          change = {
            close: (parseFloat(day_obj.close) - parseFloat(close)).toFixed(4),
            vwap: (parseFloat(day_obj.vwap) - parseFloat(vwap)).toFixed(4),
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
      summary.vwap = getVWAP(all_trades).vwap;
      summary.totalVol = getVWAP(all_trades).totalVol;
      summary.open = getOHLC(all_trades).open;
      summary.high = getOHLC(all_trades).high;
      summary.low = getOHLC(all_trades).low;
      summary.close = getOHLC(all_trades).close;

      const prev_day_trades = await getPrevDayTrades(series, start_date);
      const good_vol = prev_day_trades.filter((el) => el.lastDealtVol >= 50);
      const { vwap: vwap_prev } = getVWAP(good_vol);
      const { close: close_prev } = getOHLC(good_vol);

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

export const fetchTimeAndSales = async (period_input, series_input) => {
  try {
    const series = await getSeries(series_input);

    // validate the period

    console.log("in fetchTimeAndSales: ");
    console.log("series: ", series);

    let date = null;

    // if no period was supplied, just use the current day, or if on a weekend, the latest friday
    if (!period_input) {
      const day_of_week = dayjs(date).format("ddd");
      const is_weekend = ["Sun", "Sat"].includes(day_of_week);
      if (is_weekend) {
        // if date lies on a weekend, get the most recent weekday instead
        date = dayjs().day(5).startOf("day").toDate();
      } else {
        // else just get the current date
        date = dayjs().toDate();
      }
    } else {
      date = dayjs(period_input, ["MM/DD", "MM/DD/YY", "MM/DD/YYYY"]).toDate();
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

      array = unsorted.sort((a, b) => {
        return b.time - a.time;
      });

      console.log("array.length: ", array.length);

      summary.trades = array.length;

      console.log("array[0]: ", array[0]);
      summary.totalVol = getVWAP(array)?.totalVol;
    } else {
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
        summary.vwap = getVWAP(goodVolTrades)?.vwap;
        summary.totalVol = getVWAP(array)?.totalVol;
        const { open, high, low, close } = getOHLC(goodVolTrades);
        summary.open = open;
        summary.high = high;
        summary.low = low;
        summary.close = close;
      }

      const prev_day_trades = await getPrevDayTrades(series, day_beg);

      if (goodVolTrades.length > 0 && prev_day_trades.length > 0) {
        const good_vol = prev_day_trades.filter((el) => el.lastDealtVol >= 50);
        const { vwap, totalVol } = getVWAP(good_vol);
        const { open, high, low, close } = getOHLC(good_vol);
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
      const { summary } = await fetchHistoricalPrices(series, period);
      return {
        series,
        summary,
      };
    })
  );

  const { start_date, end_date } = getPeriod(period);

  // get last traded date for those without trades
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
