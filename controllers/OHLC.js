import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);

import OHLC from "../models/OHLC.js";
import { getOHLC, getVWAP, sortByTime } from "../utils/updates.js";

const createOHLCBar = async (trades) => {
  try {
    // validation
    if (typeof trades !== Array)
      throw new Error("Should be an array of trades.");

    if (trades.length == 0) return "No trades to upload.";

    // sort trades by time
    const sorted_trades = sortByTime(trades);
    // get the ISIN
    const isin = trades[0].isin;
    // get the series
    const series = trades[0].series;

    // use getOHLC on the array
    const { open, high, low, close } = getOHLC(sorted_trades);
    // use getVWAP on the array
    const { vwap, totalVol } = getVWAP(sorted_trades);

    // get the time of the last trade
    const time = sorted_trades[sorted_trades.length - 1].time;

    const date = dayjs(time).format("YYYY-MM-DD");
    const unix = dayjs(time).unix();

    const new_ohlc = new OHLC({
      isin,
      series,
      open,
      high,
      low,
      close,
      volume: totalVol,
      date,
      time: unix,
    });

    const saved_ohlc = await new_ohlc.save();

    return saved_ohlc;
  } catch (err) {
    return err.name;
  }
};

const mapOHLCOfSecurity = async (isin, date) => {
  try {
    // get trades of that isin on that particular date
    //
  } catch (err) {
    return err;
  }
};
