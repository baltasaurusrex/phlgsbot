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
import { uploadTimeAndSalesCSV } from "./controllers/timeAndSales.js";
import { getTimeAndSalesCSV } from "./controllers/timeAndSales.js";
import dayjs from "dayjs";
import { onlyUnique } from "./utils/tools.js";
import { getValidIsins } from "./controllers/isins.js";
import { updateAdmins } from "./botlogic/broadcast.js";

const testing = async () => {};

export default testing;
