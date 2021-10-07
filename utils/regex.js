// export const getAdminPricesUpdateRegexOld = (validIsins) =>
//   new RegExp(
//     `^(${validIsins.join(
//       "|"
//     )})\\s(\\d+|na)\\s(\\d+|na)\\s(\\d+|na)\\s(\\d+|na)\\s(([pPaAtTgG]\\w*))`,
//     "i"
//   );

export const getAdminPricesUpdateRegex = (validIsins) =>
  new RegExp(
    `^(${validIsins.join(
      "|"
    )})\\s(\\d+|na|\\/)\\s(\\d+|na|\\/)(?:\\s(\\d+))?(?:\\s(\\d+))?\\s([pPaAtTgG]\\w*)`,
    "i"
  );

export const getAdminDealtUpdateRegex = (validIsins) =>
  new RegExp(
    `^(${validIsins.join(
      "|"
    )})\\s(given|lifted|taken|mapped)\\s(\\d+)\\s(\\d+)?\\s?([pPaAtTgG]\\w*)?(?:\\s*)(?:(\\d{1,4})(am|pm))?`,
    "i"
  );

export const getFetchPriceInfoRegex = (validIsins) =>
  new RegExp(`^(?:(${validIsins.join("|")})\\s*?)+$`, "i");

export const getCreateOrderRegex = (validIsins, nicknames) => {
  const validNicknames = [...nicknames, "i"];
  return new RegExp(
    `^(${validIsins.join("|")})(?:\\s*)(${validNicknames.join(
      "|"
    )})(?:\\s*)(pay|offer)s?(?:\\s*)(\\d+)(?:\\s*)(\\d+)?(?:\\s*)([pPaAtTgG]\\w*)(?:\\s*)$`,
    "i"
  );
};
