import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);

import OHLC from "../models/OHLC.js";
import { getOHLC, getVWAP, sortByTime } from "../utils/updates.js";
import { fetchTrades, getAllTradeDates } from "./updates.js";
import { getValidIsins } from "./isins.js";

const createOHLCBar = async (trades) => {
  try {
    // validation
    if (!Array.isArray(trades))
      throw new Error("Should be an array of trades.");

    if (trades.length == 0) return "No trades to upload.";

    // sort trades by time
    const sorted_trades = sortByTime(trades);
    // get the ISIN
    const isin = trades[0].isin;
    // get the series
    const series = trades[0].series;

    // use getOHLC on the array
    const { open, high, low, close } = getOHLC(sorted_trades, {
      goodVolOnly: false,
    });
    // use getVWAP on the array
    const { vwap, totalVol } = getVWAP(sorted_trades, { goodVolOnly: false });

    // get the time of the last trade
    const time = sorted_trades[sorted_trades.length - 1].time;

    const date = dayjs(time).format("YYYY-MM-DD");
    const unix = dayjs(time).unix();
    const ms = dayjs(time).valueOf();

    // check if there's an existing OHLC, if there is, overwrite that
    let existing = await OHLC.findOne({ isin, date });

    let data = {
      isin,
      series,
      open,
      high,
      low,
      close,
      volume: totalVol,
      date,
      time: ms,
    };

    let ohlc = null;

    if (existing) {
      ohlc = await OHLC.findByIdAndUpdate(
        existing,
        { ...data },
        { new: true }
      ).lean();
    } else {
      const new_ohlc = new OHLC({
        ...data,
      });

      ohlc = (await new_ohlc.save())._doc;
    }

    return ohlc;
  } catch (err) {
    return err.name;
  }
};

// format = MM/DD/YYYY
export const mapOHLCOfSecurity = async (isin, date) => {
  try {
    // get trades of that isin on that particular date
    const trades = await fetchTrades(isin, date); // format = MM/DD/YYYY

    if (trades.length == 0)
      return `No trades of isin: ${isin} to map for date: ${date}`;
    // feed to createOHLCBar function
    const OHLCBar = await createOHLCBar(trades);

    console.log("OHLCBar: ", OHLCBar);

    return OHLCBar;
  } catch (err) {
    return err;
  }
};

export const mapAllOHLCsOfSecurity = async (isin) => {
  try {
    const validIsins = await getValidIsins();
    if (!validIsins.includes(isin)) throw new Error("Not a valid ISIN.");

    // get an array of dates an isin was mapped at
    const allDates = await getAllTradeDates(isin);

    // forEach of those dates, pass in the date to the mapOHLCOfSecurity function
    const res = await Promise.all(
      allDates.map(async (date) => await mapOHLCOfSecurity(isin, date))
    );

    return res;
  } catch (err) {
    return err;
  }
};

export const getOHLCData = async (isin) => {
  try {
    const validIsins = await getValidIsins();
    if (!validIsins.includes(isin)) throw new Error("Not a valid ISIN.");

    let data = await OHLC.find({ isin }).lean();

    data = data.sort((a, b) => a.time - b.time);

    const formatted = data.map((ohlc) => {
      let obj = { ...ohlc, time: dayjs(ohlc.date).format("YYYY-MM-DD") };
      delete obj.date;
      delete obj._id;
      delete obj.__v;
      return obj;
    });

    return formatted;
  } catch (err) {
    return err;
  }
};

export const deleteOHLCs = async (date) => {
  try {
    if (!date) return "no date supplied";

    const startOfDay = dayjs(date).startOf("day").toDate();

    const endOfDay = dayjs(date).endOf("day").toDate();

    const deleted = await OHLC.deleteMany({
      time: { $gte: startOfDay, $lt: endOfDay },
    });

    return deleted;
  } catch (err) {
    return err;
  }
};
