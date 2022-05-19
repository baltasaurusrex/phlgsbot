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
import { getUploadTimeAndSalesRegex } from "./utils/regex.js";

const testing = async () => {
  const res = await getTimeAndSalesCSV("2022-05-17");
  if (!res.trades_with_series) {
    // if an error is returned
    updateAdmins(res);
    return;
  }

  if (res.trades_with_series.length < 1) {
    // if  there are no trades
    updateAdmins(res.message);
    return;
  }

  if (res.invalidIsins.length > 0) {
    // if there's an invalid isin, notify the admin
    updateAdmins(`Invalid isins: ${res.invalidIsins.join(", ")}`);
  } // but then continue to upload the rest

  const { spiel, uploaded_trades, mappedOHLCs } = await uploadTimeAndSalesCSV(
    res.trades_with_series
  );

  updateAdmins(spiel);
};

export default testing;
