import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
  getShowOrdersRegex,
  getOffOrdersRegex,
  getPendingDealtOrderRegex,
  getFetchHistoricalPricesRegex,
  getFetchTimeAndSalesRegex,
} from "./regex.js";

export const validCommand = (
  text,
  validSeries,
  validNicknames,
  validDesks,
  pending
) => {
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

  const fetchHistoricalPricesRegex = getFetchHistoricalPricesRegex(validSeries);

  if (fetchHistoricalPricesRegex.test(text)) flag = true;

  const fetchTimeAndSalesRegex = getFetchTimeAndSalesRegex(validSeries);

  if (fetchTimeAndSalesRegex.test(text)) flag = true;

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

  if (pending.length > 0) {
    const pendingDealtOrderRegex = getPendingDealtOrderRegex();
    if (pendingDealtOrderRegex.test(text)) flag = true;
  }

  return flag;
};
