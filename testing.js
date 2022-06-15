import { getAdminPricesUpdateRegex } from "./utils/regex.js";
import { pricesUpdateLogic } from "./botlogic/updates.js";
import { getValidSeries } from "./controllers/isins.js";

const testing = async () => {
  const text = "767 675 655 p";
  const validSeries = await getValidSeries();
  const userProfile = null;
  const user = null;

  const pricesUpdateRegex = getAdminPricesUpdateRegex(validSeries);
  if (pricesUpdateRegex.test(text)) {
    console.log(`regex triggered: pricesUpdateRegex.test(text)`);
    const match = text.match(pricesUpdateRegex);

    const messages = await pricesUpdateLogic(userProfile, match, user);
  } else {
    console.log("regex not triggered");
  }

  return;
};

export default testing;
