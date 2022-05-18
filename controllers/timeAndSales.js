import axios from "axios";
import { getPDSDateFormat, getPDSDataExtractionRegex } from "../utils/regex.js";
import { time_and_sales } from "../utils/test_data.js";
import { getSeries, getValidIsins, getSeriesWithIsin } from "./isins.js";
import { createDealtUpdate, deleteLastDealts } from "./updates.js";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import { getBBAId } from "../utils/admin.js";
import { getTotalVol } from "../utils/updates.js";
import { getTimeAndSales } from "../api/PDSMarketPage.js";
import { onlyUnique } from "../utils/tools.js";
import { mapOHLCOfSecurity } from "./OHLC.js";

const instance = axios.create({
  baseURL: "https://marketpage.pds.com.ph/",
});

const default_params = {
  callback: "angular.callbacks._j",
  participant: "all",
  token: "7VpYt1atB86CHE5MPLYU",
};

export const getTimeAndSalesCSV = async (trade_date) => {
  // trade_date should be formatted like this: YYYY-MM-DD
  // if not supplied, then that means get todays date
  try {
    let params_obj = {
      ...default_params,
    };

    const PDSDateFormatRegex = getPDSDateFormat();

    // if an argument was supplied and it doesnt meet the regex format
    if (trade_date && !PDSDateFormatRegex.test(trade_date))
      throw new Error("Improperly formatted date.");

    // if an argument was supplied and it meets the date regex, include that date in the params
    if (PDSDateFormatRegex.test(trade_date)) params_obj.trade_date = trade_date;

    let res = {};

    // and either fetch for that date
    if (params_obj.trade_date) {
      res = await getTimeAndSales(params_obj.trade_date);
    } else {
      // or dont fetch for that date
      res = await getTimeAndSales();
    }

    const PDSDataExtractionRegex = getPDSDataExtractionRegex();

    const data_string = res.data.match(PDSDataExtractionRegex)[1];

    const data = JSON.parse(data_string);

    const { stats, items } = data;

    if (items.length == 0) {
      const mmddyy_date = dayjs(trade_date, "YYYY-MM-DD", true).format(
        "MM/DD/YY"
      );
      return {
        message: `No trades to upload for ${mmddyy_date}`,
        trades_no_series: [],
        trades_with_series: [],
        invalidIsins: [],
      };
    }

    const BBAId = await getBBAId();

    // pull trade details
    const trades_no_series = items.map((item) => {
      let date = null;

      // if !trade_date, use today's date
      if (!trade_date) {
        date = dayjs().format("YYYY-MM-DD");
      } else {
        // else, use the provided trade_date
        date = dayjs(trade_date).format("YYYY-MM-DD");
      }

      const time_string = `${date} ${item.tradeTime}`;
      const time = dayjs(time_string, "YYYY-MM-DD HH:mm:ss", true).format();

      const trade_obj = {
        isin: item.secCode, // this is where the isin gets included
        type: "last_dealt",
        action: "mapped",
        price: Number.parseFloat(item.yield),
        volume: Number.parseFloat(item.quantity),
        broker: "MOSB",
        creator: BBAId,
        time: time,
      };
      return trade_obj;
    });

    // build something for getting the series names
    // create an array of missing ISINs
    // throw an error if theres no series name yet and return that error

    const validIsins = await getValidIsins();
    let invalidIsins = [];

    const trades_with_series = (
      await Promise.all(
        trades_no_series.map(async (trade) => {
          if (!validIsins.includes(trade.isin)) {
            if (!invalidIsins.includes(trade.isin))
              invalidIsins.push(trade.isin);
            return null;
          }
          const series = await getSeriesWithIsin(trade.isin);
          return {
            ...trade,
            series,
          };
        })
      )
    ).filter((trade) => trade !== null);

    console.log("invalidIsins: ", invalidIsins);

    return { trades_no_series, trades_with_series, invalidIsins };
  } catch (err) {
    console.log("err: ", err);
    return err;
  }
};

export const uploadTimeAndSalesCSV = async (trade_array_input) => {
  try {
    if (!trade_array_input || trade_array_input.length === 0) {
      return "Missing trade_array_input";
    }

    // sort trade_array_input by time
    const trade_array = trade_array_input.sort((a, b) => {
      const a_time = new Date(a.time);
      const b_time = new Date(b.time);
      return b_time - a_time;
    });

    const last_trade = trade_array[0];
    const date = dayjs(last_trade.time).toDate();

    const deletedLastDealts = await deleteLastDealts(date);
    console.log("deletedLastDealts: ", deletedLastDealts);

    // slice(start, end)
    // trade_array is sorted [0] last trade of the period -> [n] first trade of the period
    // slice(-10) --> first 10 trades

    const uploaded_trades = await Promise.all(
      trade_array.slice().map(async (trade) => {
        const uploaded_trade = await createDealtUpdate({ ...trade });
        return uploaded_trade;
      })
    );

    const last_uploaded_trade = uploaded_trades[0];

    const time = dayjs(last_uploaded_trade.time).format("h:mm A");
    const mmddyy_date = dayjs(last_uploaded_trade.time).format("MM/DD/YY");

    const total_vol = getTotalVol(uploaded_trades.map((deal) => deal._doc));

    // add total vol to this
    const spiel = `Time and sales updated as of:\n${time}, ${mmddyy_date}\n${uploaded_trades.length} deals added\nTotal vol: ${total_vol} Mn`;

    // upload OHLC bars
    const isins_uploaded = uploaded_trades
      .map((el) => el.isin)
      .filter(onlyUnique);

    const dateString = dayjs().format("MM/DD/YYYY");

    const mappedOHLCs = await Promise.all(
      isins_uploaded.map(async (isin) => mapOHLCOfSecurity(isin, dateString))
    );

    return { spiel, uploaded_trades, mappedOHLCs };
  } catch (err) {
    return err;
  }
};
