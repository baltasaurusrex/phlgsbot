import {
  fetchHistoricalPrices,
  fetchTrades,
  getAllTradeDates,
} from "./controllers/updates.js";
import { getPeriod } from "./utils/updates.js";
import {
  mapAllOHLCsOfSecurity,
  mapOHLCOfSecurity,
} from "./controllers/OHLC.js";
import { fetchTimeAndSales } from "./controllers/updates.js";

const testing = async () => {
  // getPeriod("mtd");
  // await fetchTimeAndSales();ß
  // await fetchHistoricalPrices("515", "weekly");
};

export default testing;
