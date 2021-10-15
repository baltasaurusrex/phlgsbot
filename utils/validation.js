import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
  getShowOrdersRegex,
  getOffOrdersRegex,
} from "./regex.js";

export const validCommand = (text, validSeries, validNicknames, validDesks) => {
  let flag = false;
  // if the flag is toggled to true, that means a valid command was hit

  if (/^help/gi.test(text)) flag = true;
  if (/^((admin)|(broker)|(dealer))/gi.test(text)) flag = true;
  if (/^test/gi.test(text)) flag = true;

  const adminPricesUpdateRegex = getAdminPricesUpdateRegex(validSeries);

  if (adminPricesUpdateRegex.test(text)) flag = true;

  const adminDealtUpdateRegex = getAdminDealtUpdateRegex(validSeries);

  if (adminDealtUpdateRegex.test(text)) flag = true;

  const fetchPriceInfoRegex = getFetchPriceInfoRegex(validSeries);

  if (fetchPriceInfoRegex.test(text)) flag = true;

  const createOrderRegex = getCreateOrderRegex(validSeries, validNicknames);

  if (createOrderRegex.test(text)) flag = true;

  const showOrdersRegex = getShowOrdersRegex(
    validSeries,
    validDesks,
    validNicknames
  );

  if (showOrdersRegex.test(text)) flag = true;

  const offOrdersRegex = getOffOrdersRegex(
    validSeries,
    validDesks,
    validNicknames
  );

  if (offOrdersRegex.test(text)) flag = true;

  return flag;
};
