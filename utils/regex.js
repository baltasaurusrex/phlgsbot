export const getAdminPricesUpdateRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})\\s(?:\\s*)(\\d*\\.?\\d*)\\s(?:\\s*)(?:(\\d*\\.?\\d*)|(bid|offer))\\s(?:\\s*)(\\d*\\.?\\d*)?(?:\\s*)(\\d*\\.?\\d*)?(?:\\s*)((?![patg]*?([patg])\\8)[patg]*)(?:\\s*)$`,
    "i"
  );

// regex for no repeating patg
// ^(577|1061)\s(?:\s*)(\d*\.?\d*)\s(?:\s*)(?:(\d*\.?\d*)|(bid|offer))(?:\s*)(\d*\.?\d*)?(?:\s*)(\d*\.?\d*)?(?:\s*)((?![patg]*?([patg])\8)[patg]*)(?:\s*)$

export const getOffPricesRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})\\s(?:\\s+)?(?:off (prices|bid|offer))\\s(?:\\s+)?([pPaAtTgG]\\w*)`,
    "i"
  );

export const getAdminDealtUpdateRegex = (validSeries) => {
  return new RegExp(
    `^(${validSeries.join(
      "|"
    )})(?:\\s+)(given|lifted|taken|mapped)(?:\\s+)(\\d*\\.?\\d*)(?:\\s*)(\\d*\\.?\\d*)?(?:\\s*)?(?:\\s((?![patg]*?([patg])\\6)[patg]*))?(?:\\s*)?(?:(\\d{1,4})(am|pm))?(?:\\s*)$`,
    "i"
  );
};

// with non repeating patg
// ^(1061|577)(?:\s+)(given|lifted|taken|mapped)(?:\s+)(\d*\.?\d*)(?:\s*)(\d*\.?\d*)?(?:\s*)?(?:\s((?![patg]*?([patg])\6)[patg]*))?(?:\s*)?(?:(\d{1,4})(am|pm))?(?:\s*)$

export const getFetchPriceInfoRegex = (validSeries) =>
  new RegExp(`^(?:(${validSeries.join("|")})\\s*?)+$`, "i");

// has two capturing groups (Group 1)-(Group 2), so when incorporating this into other regex's, adjust accordingly
// MM/DD/YY-MM/DD/YY
//
const arbitrary_dates = `((?:1[0-2]|0?[1-9])\\/(?:3[01]|[12][0-9]|0?[1-9])(?:\\/(?:[0-9]{2})?[0-9]{2})?)(?:-((?:1[0-2]|0?[1-9])\\/(?:3[01]|[12][0-9]|0?[1-9])(?:\\/(?:[0-9]{2})?[0-9]{2})?))?`;
const period_shortcuts = [
  "wtd",
  "weekly",
  "1 week",
  "2 weeks",
  "1 month",
  "last week",
  "last 2 weeks",
  "mtd",
];

const PDSDateFormat = `^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$`;
export const getPDSDateFormat = () => new RegExp(PDSDateFormat, "gi");

export const PDSDataExtraction = `angular.callbacks._j\\(([\\s\\S]+)\\)`;
export const getPDSDataExtractionRegex = () =>
  new RegExp(PDSDataExtraction, "i");

export const getArbitraryDatesRegex = () => new RegExp(arbitrary_dates, "i");

export const getFetchHistoricalPricesRegex = (validSeries) =>
  new RegExp(
    `^(${validSeries.join(
      "|"
    )})(?:\\s+)?(${arbitrary_dates}|${period_shortcuts.join("|")})(?:\\s+)?$`,
    "i"
  );

export const getFetchTimeAndSalesRegex = (validSeries) =>
  new RegExp(
    `^(?:time and sales)(?:\\s*)(\\d\\d\\/\\d\\d)?(?:\\s*)(${validSeries.join(
      "|"
    )})?(?:\\s+)?$`,
    "i"
  );

export const getUpdateISINsRegex = () => {
  return new RegExp(`update isins?`, "i");
};

export const getUploadTimeAndSalesRegex = () => {
  return new RegExp(
    `(?:upload time and sales)(?:\\s((?:1[0-2]|0?[1-9])\\/(?:3[01]|[12][0-9]|0?[1-9])(?:\\/(?:[0-9]{2})?[0-9]{2})?))?(?:\\s*)$`,
    "i"
  );
};

export const getFetchSummariesRegex = () =>
  new RegExp(
    `^(?:summary)(?:\\s*)(?:\\s(${arbitrary_dates}|${period_shortcuts.join(
      "|"
    )}))?(?:\\s+)?$`,
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

export const getAutoUploadRegex = () => {
  return new RegExp(`^auto upload (on|off|status)$`, "i");
};
