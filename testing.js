import { fetchTrades } from "./controllers/updates.js";
import { getPeriod } from "./utils/updates.js";

const testing = async () => {
  // getPeriod("mtd");
  const trades = await fetchTrades("PIID0525H130", "1 week");
};

export default testing;
