export const getAdminPricesUpdateRegex = (validIsins) =>
  new RegExp(
    `^(${validIsins.join(
      "|"
    )})\\s(\\d+|na)\\s(\\d+|na)\\s(\\d+|na)\\s(\\d+|na)\\s(([pPaAtTgG]\\w*))`,
    "i"
  );

export const getAdminDealtUpdateRegex = (validIsins) =>
  new RegExp(
    `^(${validIsins.join(
      "|"
    )})\\s(given|lifted|taken|mapped)\\s(\\d+)\\s(\\d+)\\s(([pPaAtTgG]\\w*))`,
    "i"
  );

export const getFetchPriceInfoRegex = (validIsins) =>
  new RegExp(`^(${validIsins.join("|")}(\\s|$))+`, "i");
