import { bot } from "../index.js";
import pkg from "viber-bot";
const { Bot, Events, Message } = pkg;

import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);

import dotenv from "dotenv";
dotenv.config();

import {
  createPricesUpdate,
  createDealtUpdate,
  fetchPricingData,
  fetchHistoricalPrices,
  fetchTimeAndSales,
  deleteLastDealts,
  fetchSummary,
} from "../controllers/updates.js";
import { formatPrice, getBroker, formatTime } from "../utils/updates.js";

import {
  createOrder,
  fetchOrders,
  offOrders,
  fillOrder,
} from "../controllers/orders.js";

import { getValidSeries, getSeries } from "../controllers/isins.js";

export const showBot = () => {
  console.log("bot: ", bot);
};

export const pricesUpdateLogic = async (userProfile, match, user) => {
  console.log("in pricesUpdateLogic");
  const [
    full,
    seriesInput,
    bidInput,
    offerInput,
    bidOrOfferInput,
    vol1,
    vol2,
    brokerInput,
  ] = match;

  let series = await getSeries(seriesInput);
  let bid = null;
  let offer = null;
  if (!offerInput) {
    if (bidOrOfferInput === "bid") bid = formatPrice(bidInput);
    if (bidOrOfferInput === "offer") offer = formatPrice(bidInput);
  } else {
    bid = formatPrice(bidInput);
    offer = formatPrice(offerInput);
  }

  const bid_vol = bid ? (vol1 ? Number.parseFloat(vol1) : 50) : null;

  const offer_vol = offer
    ? bid
      ? vol2
        ? Number.parseFloat(vol2)
        : 50
      : vol1
      ? Number.parseFloat(vol1)
      : 50
    : null;

  console.log("bid_vol: ", bid_vol);
  console.log("offer_vol: ", offer_vol);

  const broker = getBroker(brokerInput);

  console.log("broker: ", broker);

  const update = await createPricesUpdate(
    {
      series,
      bid,
      offer,
      bid_vol,
      offer_vol,
      broker,
      user,
    },
    { nullIgnored: true }
  );

  console.log("update: ", update);

  let message = `${update.series} prices updated\n\nBid: ${
    !update.bid ? "none" : `${update.bid} for ${update.bid_vol} Mn`
  } \nOffer: ${
    !update.offer ? "none" : `${update.offer} for ${update.offer_vol} Mn`
  }\non ${update.broker}`;

  bot.sendMessage(userProfile, [new Message.Text(message)]);

  return message;
};

export const offPricesLogic = async (userProfile, match, user) => {
  const [full, seriesInput, sideInput, brokerInput] = match;

  let series = await getSeries(seriesInput);
  let side = sideInput.toLowerCase();
  const broker = getBroker(brokerInput);

  let update = null;
  if (side === "prices") {
    update = await createPricesUpdate({
      series,
      bid: null,
      offer: null,
      bid_vol: null,
      offer_vol: null,
      broker,
      user,
    });
  } else if (side === "bid") {
    update = await createPricesUpdate({
      series,
      bid: null,
      bid_vol: null,
      broker,
      user,
    });
  } else if (side === "offer") {
    update = await createPricesUpdate({
      series,
      offer: null,
      offer_vol: null,
      broker,
      user,
    });
  }

  let message = `${series} ${side} taken out on ${broker}:\n\n Bid: ${
    !update.bid ? "none" : `${update.bid} for ${update.bid_vol} Mn`
  } \nOffer: ${
    !update.offer ? "none" : `${update.offer} for ${update.offer_vol} Mn`
  }\non ${update.broker}`;

  return message;
};

export const dealtUpdateLogic = async (userProfile, match, user) => {
  const [
    full,
    seriesInput,
    action,
    priceInput,
    volInput,
    brokerInput,
    timeString,
    timePeriod,
  ] = match;

  console.log("match: ", match);

  const series = await getSeries(seriesInput);
  const price = formatPrice(priceInput);
  const volume = volInput ? Number.parseFloat(volInput) : 50;
  console.log("volume: ", volume);
  const broker = brokerInput ? getBroker(brokerInput) : "MOSB";
  const time =
    timeString && timePeriod
      ? formatTime(timeString, timePeriod)
      : dayjs().format();

  console.log("series: ", series);
  console.log("action: ", action);
  console.log("price: ", price);
  console.log("broker: ", broker);
  console.log("time: ", time);

  // Create the "last_dealt" update
  const update = await createDealtUpdate({
    series,
    price,
    action,
    volume,
    broker,
    creator: user,
    time,
  });

  console.log("update: ", update);

  const formattedTime = dayjs(update.time).format("h:mm A");

  bot.sendMessage(userProfile, [
    new Message.Text(
      `${series} was ${action} at ${price} for ${volume} Mn \n\non ${broker} at ${formattedTime}`
    ),
  ]);

  // Look for possible existing orders on that series, at that price, and on that broker (across all desks)
  const desk = undefined;
  const possibleOrders = await fetchOrders(series, price, desk, broker);
  console.log("possibleOrders: ", possibleOrders);

  // If possible orders exist
  if (possibleOrders.length > 0) {
    // create PendingQueries for each of them
    const results = await Promise.allSettled(
      possibleOrders.map(async (order) => await createPendingQuery(user, order))
    );

    let fulfilled = results.filter((el) => el.status === "fulfilled");
    let rejected = results.filter((el) => el.status === "rejected");
    console.log("fulfilled: ", fulfilled);
    console.log("rejected: ", rejected);

    bot.sendMessage(userProfile, [
      new Message.Text(
        `Has this order been dealt?\n\n${renderOrder(possibleOrders[0])}`
      ),
    ]);
  }

  return;
};

export const fetchPriceInfoLogic = async (userProfile, list) => {
  const formattedList = await Promise.all(
    list.map(async (unformattedSeries) => await getSeries(unformattedSeries))
  );

  bot.sendMessage(userProfile, [
    new Message.Text(
      `Requesting for pricing data on ${formattedList.join(", ")}...`
    ),
  ]);

  let results = await Promise.all(
    formattedList.map(async (series) => await fetchPricingData(series))
  );

  for (const result of results) {
    const {
      series,
      quotes,
      bestBidOffer,
      lastDealt,
      prevLastDealt,
      vwap,
      totalVol,
    } = result;
    console.log("lastDealt: ", lastDealt);
    console.log("prevLastDealt: ", prevLastDealt);

    const renderBestPrices = () => {
      if (!bestBidOffer) {
        return "";
      }

      const renderBid = () => {
        const totalBidVol = bestBidOffer.bestBidVols.reduce(
          (acc, a) => acc + a,
          0
        );
        if (bestBidOffer.bestBid && bestBidOffer.bestBidVols.length >= 0) {
          return `${totalBidVol} Mn ${bestBidOffer.bestBid}`;
        } else {
          return "none";
        }
      };

      const renderOffer = () => {
        const totalOfferVol = bestBidOffer.bestOfferVols.reduce(
          (acc, a) => acc + a,
          0
        );
        if (bestBidOffer.bestOffer && bestBidOffer.bestOfferVols.length >= 0) {
          return `${bestBidOffer.bestOffer} ${totalOfferVol} Mn`;
        } else {
          return "none";
        }
      };
      return `\n\nBest Prices:\n${renderBid()} | ${renderOffer()}`;
    };

    const renderLastDealt = () => {
      if (!lastDealt) {
        return "";
      }

      const timestamp = `on ${lastDealt.broker} at ${dayjs(
        lastDealt.time
      ).format("h:mm A")}`;

      const sameDay =
        dayjs().format("ddd") === dayjs(lastDealt.time).format("ddd");
      const fromNowDay = sameDay
        ? `today`
        : `last ${dayjs(lastDealt.time).format("ddd")}`;

      return `\n\nlast ${lastDealt.direction} at ${lastDealt.lastDealt} for ${lastDealt.lastDealtVol} Mn\n${timestamp} ${fromNowDay}`;
    };

    const renderPrevLastDealt = () => {
      if (!prevLastDealt || (!prevLastDealt && !lastDealt)) return "";

      if (prevLastDealt && !lastDealt) {
        const { time: timePrev } = prevLastDealt;
        const timeFrom = dayjs().to(dayjs(timePrev));

        return `\n\nlast ${prevLastDealt.direction} at ${prevLastDealt.lastDealt} for ${prevLastDealt.lastDealtVol} Mn\n${timeFrom}`;
      }

      const { lastDealt: lastDealtNow, time: timeNow } = lastDealt;
      const { lastDealt: lastDealtPrev, time: timePrev } = prevLastDealt;

      const bpsDiff = ((lastDealtNow - lastDealtPrev) * 100).toFixed(3);

      console.log();

      const sign = Math.sign(lastDealtNow - lastDealtPrev);
      let signToShow = null;

      if (sign === 1) {
        signToShow = "+";
      } else {
        signToShow = "";
      }

      const yesterday =
        dayjs().subtract(1, "day").format("ddd") ===
        dayjs(timePrev).format("ddd");
      const fromNowDay = yesterday
        ? `from yesterday`
        : `from last ${dayjs(timePrev).format("ddd")}`;
      console.log("timeNow: ", timeNow);
      console.log("timePrev: ", timePrev);

      return `\n${signToShow ? signToShow : ""}${bpsDiff} bps ${fromNowDay}`;
    };

    const renderVWAP = () => {
      if (!lastDealt) return "";

      const { time: timeNow } = lastDealt;
      const fromNowDay = `${dayjs(timeNow).format("ddd")}`;

      const getDay = () => {
        const today = dayjs().format("ddd");
        const fromNowDay = dayjs(timeNow).format("ddd");

        return today === fromNowDay ? "today" : `last ${fromNowDay}`;
      };

      return `\n\nVWAP ${getDay()}: ${vwap}\nVolume ${getDay()}: ${totalVol} Mn`;
    };

    const renderBrokers = () => {
      if (quotes?.length === 0) {
        return "\n\nno levels";
      } else {
        const brokerString = quotes.map((quote) => {
          const timestamp = `last updated ${dayjs(quote.updatedAt).format(
            "h:mm A"
          )}`;

          const renderBid = () => {
            if (quote.bid && quote.bid_vol) {
              const bestBid = bestBidOffer.bestBid === quote.bid;
              return `${bestBid ? "*" : ""}${quote.bid_vol} Mn ${quote.bid}${
                bestBid ? "*" : ""
              }`;
            } else {
              return "none";
            }
          };
          const renderOffer = () => {
            if (quote.offer && quote.offer_vol) {
              const bestOffer = bestBidOffer.bestOffer === quote.offer;
              return `${bestOffer ? "*" : ""}${quote.offer} ${
                quote.offer_vol
              } Mn${bestOffer ? "*" : ""}`;
            } else {
              return "none";
            }
          };

          const returnString = `\n\n${
            quote.broker
          }\n${renderBid()} | ${renderOffer()}\n${timestamp}`;

          return returnString;
        });

        return brokerString.join("");
      }
    };

    bot.sendMessage(userProfile, [
      new Message.Text(
        `*${
          result.series
        }*${renderBestPrices()}${renderLastDealt()}${renderPrevLastDealt()}${renderVWAP()}${renderBrokers()}`
      ),
    ]);
  }
  return;
};

export const fetchHistoricalPricesLogic = async (userProfile, match) => {
  const [full, seriesInput, periodInput] = match;
  const series = await getSeries(seriesInput);
  const period = periodInput.toLowerCase();
  const { array, summary } = await fetchHistoricalPrices(series, period);

  bot.sendMessage(userProfile, [
    new Message.Text(`Fetching historical price data for ${series}...`),
  ]);

  const renderData = (days) => {
    return days.map((day) => {
      const dayOfWeek = dayjs(day.date).format("ddd");
      const shortDate = dayjs(day.date).format("MM/DD");

      console.log("day: ", day);

      if (day.trades === 0) {
        return `${dayOfWeek}, ${shortDate}: No trades w/ good vol\n\n`;
      } else {
        let change = {
          close: parseFloat(day.change.close) * 100,
          vwap: parseFloat(day.change.vwap) * 100,
        };

        change.close =
          change.close > 0
            ? "+" + change.close.toFixed(2)
            : change.close.toFixed(2);
        change.vwap =
          change.vwap > 0
            ? "+" + change.vwap.toFixed(2)
            : change.vwap.toFixed(2);

        return `${dayOfWeek}, ${shortDate}:\nOpen: ${day.open}\nHigh: ${day.high}\nLow: ${day.low}\nClose: ${day.close} (${change.close} bps)\nVWAP: ${day.vwap} (${change.vwap} bps)\nTotal vol: ${day.totalVol} Mn\nTrades: ${day.trades}\n\n`;
      }
    });
  };

  const renderSummary = (summary) => {
    let bpsChange = (
      (parseFloat(summary.close) - parseFloat(summary.open)) *
      100
    ).toFixed(2);

    bpsChange = bpsChange > 0 ? "+" + bpsChange : bpsChange;
    const startPd = dayjs(summary.startOfPeriod).format("MM/DD");
    const endPd = dayjs(summary.endOfPeriod).format("MM/DD");
    if (summary.trades > 0) {
      return `*Summary for ${startPd} - ${endPd}:* \nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} (${bpsChange} bps)\nVWAP: ${summary.vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      return `*Summary for ${startPd} - ${endPd}*:\nTrades: ${summary.trades}`;
    }
  };

  bot.sendMessage(userProfile, [
    new Message.Text(
      `${renderData(array).join("")}\n${renderSummary(summary)}`
    ),
  ]);

  return;
};

export const fetchTimeAndSalesLogic = async (userProfile, match) => {
  const [full, seriesInput, period] = match;
  const series = await getSeries(seriesInput);

  const { array, summary } = await fetchTimeAndSales(series, period);
  console.log("array: ", array);
  console.log("summary: ", summary);

  const renderMOSB = (deals) => {
    if (deals.length > 0) {
      return deals
        .map((deal) => {
          const time = dayjs(deal.time).format("h:mm A");
          return `${deal.lastDealt.toFixed(3)} | ${
            deal.lastDealtVol
          } Mn | ${time}`;
        })
        .join("\n");
    } else {
      return "No deals";
    }
  };

  let day = null;
  if (period) {
    day = dayjs(period, "MM/DD").toDate();
  } else {
    day = dayjs().toDate();
  }

  const dayOfWeek = dayjs(day).format("ddd");
  const shortDate = dayjs(day).format("MM/DD");

  const renderSummary = (summary) => {
    if (summary.trades > 0 && summary.change) {
      let change = {
        close: parseFloat(summary.change.close) * 100,
        vwap: parseFloat(summary.change.vwap) * 100,
      };

      change.close =
        change.close > 0
          ? "+" + change.close.toFixed(2)
          : change.close.toFixed(2);
      change.vwap =
        change.vwap > 0 ? "+" + change.vwap.toFixed(2) : change.vwap.toFixed(2);

      return `\n\nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} (${change.close} bps)\nVWAP: ${summary.vwap} (${change.vwap} bps)\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else if (summary.trades > 0) {
      //if there are trades but there were no good deals
      return `\n\nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close}\nVWAP: ${summary.vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      return ``;
    }
  };

  bot.sendMessage(userProfile, [
    new Message.Text(
      `${series} time and sales data for ${dayOfWeek}, ${shortDate}: \n\n${renderMOSB(
        array
      )}${renderSummary(summary)}`
    ),
  ]);

  return;
};

export const fetchSummariesLogic = async (userProfile, match) => {
  console.log("match: ", match);
  const [full, period] = match;
  const { summaries } = await fetchSummary(period);
  console.log("summaries: ", summaries);

  const renderSummary = (summaryInput) => {
    const { series, summary } = summaryInput;

    let priceDataString = null;

    if (summary.trades > 0) {
      let change =
        parseFloat(summary.close) * 100 - parseFloat(summary.open) * 100;

      if (Number.isNaN(change)) {
        change = ``;
      } else {
        change = `(${
          change > 0 ? "+" + change.toFixed(2) : change.toFixed(2)
        } bps)`;
      }

      priceDataString = `Open: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} ${change}\nVWAP: ${summary.vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      priceDataString = `No trades`;
    }

    return `\n\n${series}:\n${priceDataString}`;
  };

  const renderSummaries = (summaries) => {
    let periodIntro = null;

    if (
      ["weekly", "1 week", "2 weeks", "last week", "last 2 weeks"].includes(
        period
      )
    ) {
      const { startOfPeriod, endOfPeriod } = summaries[0].summary;
      const startPd = dayjs(startOfPeriod).format("MM/DD");
      const endPd = dayjs(endOfPeriod).format("MM/DD");

      periodIntro = `Summary for ${startPd} - ${endPd}: `;
    } else {
      let day = null;
      if (period) {
        day = dayjs(period, "MM/DD").toDate();
      } else {
        day = dayjs().toDate();
      }
      const dayOfWeek = dayjs(day).format("ddd");
      const shortDate = dayjs(day).format("MM/DD");

      periodIntro = `Summary for ${dayOfWeek}, ${shortDate}: `;
    }
    return `${periodIntro}${summaries
      .map((summary) => renderSummary(summary))
      .join("")}`;
  };

  bot.sendMessage(userProfile, [
    new Message.Text(`${renderSummaries(summaries)}`),
  ]);

  return;
};
