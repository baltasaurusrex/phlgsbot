import { fetchTrades, getAllTradeDates } from "./controllers/updates.js";
import { getPeriod } from "./utils/updates.js";
import { mapAllOHLCsOfSecurity } from "./controllers/OHLC.js";

const testing = async () => {
  // getPeriod("mtd");

  const res = await mapAllOHLCsOfSecurity("PIID0324C115");
};

export default testing;
