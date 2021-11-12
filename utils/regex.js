export const getAdminPricesUpdateRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})(?:\\s+)?(\\d+)(?:\\s+)?(?:(\\d+)|(bid|offer))?(?:\\s+)?(\\d+)?(?:\\s+)?(\\d+)?(?:\\s+)?([pPaAtTgG]\\w*)`,
    "i"
  );

export const getAdminDealtUpdateRegex = (validSeries) => {
  return new RegExp(
    `^(${validSeries.join(
      "|"
    )})\\s(given|lifted|taken|mapped)\\s(\\d+)(?:\\s*)?([\\d.]+)?(?:\\s*)?(?:\\s([pPaAtTgG]\\w*))?(?:\\s*)?(?:(\\d{1,4})(am|pm))?(?:\\s*)$`,
    "i"
  );
};

export const getFetchPriceInfoRegex = (validSeries) =>
  new RegExp(`^(?:(${validSeries.join("|")})\\s*?)+$`, "i");

export const getOffPricesRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})\\s(?:\\s+)?(?:off (prices|bid|offer))\\s(?:\\s+)?([pPaAtTgG]\\w*)`,
    "i"
  );

export const getFetchHistoricalPricesRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})(?:\\s+)?(weekly|1 week|2 weeks|1 month|last week|last 2 weeks)(?:\\s+)?$`,
    "i"
  );

export const getFetchTimeAndSalesRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})(?:\\s+)?(?:time and sales)(?:\\s+)?(\\d\\d\\/\\d\\d)?(?:\\s+)?$`,
    "i"
  );

export const getFetchSummariesRegex = () =>
  new RegExp(
    `^(?:summary)(?:\\s+)?(\\d\\d\\/\\d\\d|weekly|1 week|2 weeks|last week|last 2 weeks)?(?:\\s+)?$`,
    "i"
  );

export const getCreateOrderRegex = (validSeries, nicknames) => {
  const validNicknames = [...nicknames, "i"];
  return new RegExp(
    `^(${validSeries.join("|")})(?:\\s*)(${validNicknames.join(
      "|"
    )})(?:\\s*)(pay|offer)s?(?:\\s*)(\\d+)(?:\\s*)(\\d+)?(?:\\s*)([pPaAtTgG]\\w*)(?:\\s*)$`,
    "i"
  );
};

export const getShowOrdersRegex = (validSeries, validDesks, validNicknames) => {
  const validDesksAndNicknames = validDesks.concat(validNicknames);
  return new RegExp(
    `^[Ss]how orders(?:\\s*)(${validSeries.join(
      "|"
    )})?(?:\\s*)(${validDesksAndNicknames.join(
      "|"
    )})?(?:\\s*)([pPaAtTgG]\\w*)?(?:\\s*)$`,
    "i"
  );
};

export const getOrderDealtUpdateRegex = (
  validSeries,
  validDesks,
  validNicknames
) => {
  const validDesksAndNicknames = validDesks.concat(validNicknames);
  return new RegExp(
    `^(${validSeries.join(
      "|"
    )})\\s(given|lifted|taken|mapped)\\s(\\d+)(?:\\s*)?([\\d.]+)?(?:\\s*)?(?:\\s([pPaAtTgG]\\w*))?(?:\\s*)?(?:(\\d{1,4})(am|pm))?(?:\\s*)$`,
    "i"
  );
};

export const getOffOrdersRegex = (validSeries, validDesks, validNicknames) => {
  const validDesksAndNicknames = validDesks.concat(validNicknames);
  return new RegExp(
    `^[Oo]ff orders?(?:\\s*)(${validSeries.join(
      "|"
    )})?(?:\\s*)(${validDesksAndNicknames.join(
      "|"
    )})?(?:\\s*)([pPaAtTgG]\\w*)?(?:\\s*)$`,
    "i"
  );
};

export const getPendingDealtOrderRegex = () => {
  return new RegExp(
    `(yes|y|no|n)(?:\\sfor)?(?:(?:\\s+)(\\d+))?(?:\\s+)?$`,
    "i"
  );
};
