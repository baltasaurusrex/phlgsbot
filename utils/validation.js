import { getValidIsins } from "../controllers/isins.js";
import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
} from "./regex.js";

export const validCommand = (text, validIsins) => {
  let flag = false;

  if (/^help/gi.test(text)) flag = true;
  if (/^((admin)|(broker)|(dealer))/gi.test(text)) flag = true;
  if (/^test/gi.test(text)) flag = true;

  const adminPricesUpdateRegex = getAdminPricesUpdateRegex(validIsins);

  if (adminPricesUpdateRegex.test(text)) flag = true;

  const adminDealtUpdateRegex = getAdminDealtUpdateRegex(validIsins);

  if (adminDealtUpdateRegex.test(text)) flag = true;

  const fetchPriceInfoRegex = getFetchPriceInfoRegex(validIsins);

  if (fetchPriceInfoRegex.test(text)) flag = true;

  return flag;
};
