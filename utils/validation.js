import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
} from "./regex.js";

export const validCommand = (text, validIsins, validNicknames) => {
  let flag = false;
  // if the flag is toggled to true, that means a valid command was hit

  if (/^help/gi.test(text)) flag = true;
  if (/^((admin)|(broker)|(dealer))/gi.test(text)) flag = true;
  if (/^test/gi.test(text)) flag = true;

  const adminPricesUpdateRegex = getAdminPricesUpdateRegex(validIsins);

  if (adminPricesUpdateRegex.test(text)) flag = true;

  const adminDealtUpdateRegex = getAdminDealtUpdateRegex(validIsins);

  if (adminDealtUpdateRegex.test(text)) flag = true;

  const fetchPriceInfoRegex = getFetchPriceInfoRegex(validIsins);

  if (fetchPriceInfoRegex.test(text)) flag = true;

  const createOrderRegex = getCreateOrderRegex(validIsins, validNicknames);

  if (createOrderRegex.test(text)) flag = true;

  return flag;
};
