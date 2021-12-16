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
import {
  formatPrice,
  getBroker,
  getBrokers,
  formatTime,
  getDate,
} from "../utils/updates.js";

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

  // if there is no bid, bid_vol = null
  // if there is a bid, use vol1, or if n/a, default of 50
  const bid_vol = bid ? (vol1 ? Number.parseFloat(vol1) : 50) : null;

  // if there is no offer, offer_vol = null
  // if there is an offer, and there is a bid, use vol2, or if n/a, use default of 50
  // // 577 4100 4000
  // if there is an offer, and there is no bid, use vol1, or if n/a, use default of 50
  // // 577 4075 offer
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

  // make a getBrokers function that returns an array of broker names inputted (based on the regex string)
  const brokers = getBrokers(brokerInput);
  // const broker = getBroker(brokerInput);

  let messages = await Promise.all(
    brokers.map(async (broker) => {
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
    })
  );

  return messages;
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

  let message = `${series} prices updated\n\nBid: ${
    !update.bid ? "none" : `${update.bid} for ${update.bid_vol} Mn`
  } \nOffer: ${
    !update.offer ? "none" : `${update.offer} for ${update.offer_vol} Mn`
  }\non ${update.broker}`;

  // let message = `${series} ${side} taken out on ${broker}:\n\n Bid: ${
  //   !update.bid ? "none" : `${update.bid} for ${update.bid_vol} Mn`
  // } \nOffer: ${
  //   !update.offer ? "none" : `${update.offer} for ${update.offer_vol} Mn`
  // }\non ${update.broker}`;

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
  // const broker = brokerInput ? getBroker(brokerInput) : "MOSB";
  const brokers = getBrokers(brokerInput);

  console.log("brokers: ", brokers);

  let messages = await Promise.all(
    brokers.map(async (broker) => {
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

      let message = `${series} was ${action} at ${price} for ${volume} Mn \n\non ${broker} at ${formattedTime}`;

      bot.sendMessage(userProfile, [new Message.Text(message)]);

      return message;
    })
  );

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

  return messages;
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
  const [full, seriesInput, periodInput, startPdInput, endPdInput] = match;
  const series = await getSeries(seriesInput);
  const startPd = getDate(startPdInput);
  const endPd = getDate(endPdInput);

  const period = periodInput.toLowerCase();

  console.log("period: ", period);

  // if (startPdInput) {
  //   bot.sendMessage(userProfile, [
  //     new Message.Text(`Testing: ${startPd} to ${endPd}`),
  //   ]);
  //   return;
  // }
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
    let close_change = null;

    if (!summary.change) {
      close_change = (
        (parseFloat(summary.close) - parseFloat(summary.open)) *
        100
      ).toFixed(2);
    } else {
      console.log("has summary.change: ", summary.change);
      close_change = (parseFloat(summary.change.close) * 100).toFixed(2);
    }

    close_change = close_change > 0 ? "+" + close_change : close_change;
    const startPd = dayjs(summary.startOfPeriod).format("MM/DD");
    const endPd = dayjs(summary.endOfPeriod).format("MM/DD");
    if (summary.trades > 0) {
      return `*Summary for ${startPd} - ${endPd}:* \nTenor: ${summary.tenor}\nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} (${close_change} bps)\nVWAP: ${summary.vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      return `*Summary for ${startPd} - ${endPd}*:\nTenor: ${summary.tenor}\nTrades: ${summary.trades}`;
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
  try {
    const [full, period, seriesInput] = match;
    const series = await getSeries(seriesInput);

    const { array, summary } = await fetchTimeAndSales(period, series);
    console.log("array: ", array.length);
    console.log("summary: ", summary);

    const renderMOSB = (deals) => {
      if (deals.length > 0) {
        return deals
          .map((deal) => {
            const time = dayjs(deal.time).format("h:mm A");
            if (!series) {
              return `${deal.series} | ${deal.lastDealt.toFixed(3)} | ${
                deal.lastDealtVol
              } Mn | ${time}`;
            } else {
              return `${deal.lastDealt.toFixed(3)} | ${
                deal.lastDealtVol
              } Mn | ${time}`;
            }
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
      if (!series) {
        return `\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
      }
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
          change.vwap > 0
            ? "+" + change.vwap.toFixed(2)
            : change.vwap.toFixed(2);

        return `\nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} (${change.close} bps)\nVWAP: ${summary.vwap} (${change.vwap} bps)\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
      } else if (summary.trades > 0) {
        //if there are trades but there were no good deals
        return `\nOpen: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close}\nVWAP: ${summary.vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
      } else {
        return ``;
      }
    };

    // if array is > 50, split it into different messages

    function paginate(array, page_size) {
      let pages = Math.ceil(array.length / page_size);

      // will store an array of the spliced arrays
      let new_array = [];

      // populate the array
      for (let i = 0; i < pages; i++) {
        new_array.push(array.slice(i * page_size, page_size * (i + 1)));
      }

      return new_array;
    }

    const sub_arrays = paginate(array, 50);

    const intro_msg = new Message.Text(
      `${
        series ? series : "All"
      } time and sales data for ${dayOfWeek}, ${shortDate}: `
    );

    const mosb_msg = sub_arrays.map(
      (sub_array) => new Message.Text(`${renderMOSB(sub_array)}`)
    );

    const summary_msg = new Message.Text(`Summary:\n${renderSummary(summary)}`);

    bot.sendMessage(userProfile, [intro_msg, ...mosb_msg, summary_msg]);
    return;
  } catch (err) {
    console.log("err: ", err);
  }
};

export const fetchSummariesLogic = async (userProfile, match) => {
  console.log("match: ", match);
  const [full, period, beg, end] = match;

  // else (even if its beg) just do it normally like before
  const { array, summary } = await fetchSummary(period);
  console.log("array: ", array);
  console.log("summary: ", summary);

  const render_isin_summary = (summaryInput) => {
    const { series, summary } = summaryInput;
    console.log("in render_isin_summary");
    console.log("series: ", series);

    let priceDataString = null;

    if (summary.trades > 0) {
      console.log("summary: ", summary);
      console.log("summary.change: ", summary.change);
      let change_close = null;
      let change_vwap = null;

      if (summary.change) {
        change_close = parseFloat(summary.change.close) * 100;
        change_vwap = parseFloat(summary.change.vwap) * 100;
      } else {
        change_close =
          parseFloat(summary.close) * 100 - parseFloat(summary.open) * 100;
        change_vwap =
          parseFloat(summary.vwap) * 100 - parseFloat(summary.open) * 100;
      }

      console.log("change_close: ", change_close);
      console.log("change_vwap: ", change_vwap);

      if (Number.isNaN(change_close)) {
        change_close = ``;
      } else {
        change_close = `(${
          change_close > 0
            ? "+" + change_close.toFixed(2)
            : change_close.toFixed(2)
        } bps)`;
      }

      if (Number.isNaN(change_vwap)) {
        change_vwap = ``;
      } else {
        change_vwap = `(${
          change_vwap > 0
            ? "+" + change_vwap.toFixed(2)
            : change_vwap.toFixed(2)
        } bps)`;
      }

      priceDataString = `Open: ${summary.open}\nHigh: ${summary.high}\nLow: ${summary.low}\nClose: ${summary.close} ${change_close}\nVWAP: ${summary.vwap} ${change_vwap}\nTotal vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      priceDataString = `No trades`;
    }

    return `\n\n${series} / ${summary.tenor} yrs\n${priceDataString}`;
  };

  const render_isin_summaries = (array) => {
    let periodIntro = null;

    if (
      ["weekly", "1 week", "2 weeks", "last week", "last 2 weeks"].includes(
        period
      )
    ) {
      const { startOfPeriod, endOfPeriod } = array[0].summary;
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
    return `${periodIntro}${array
      .map((summary) => render_isin_summary(summary))
      .join("")}`;
  };

  const render_total_summary = (summary) => {
    if (summary) {
      return `Total vol: ${summary.totalVol} Mn\nTrades: ${summary.trades}`;
    } else {
      return "";
    }
  };

  const array_msg = new Message.Text(`${render_isin_summaries(array)}`);
  const summary_msg = new Message.Text(
    `Summary:\n${render_total_summary(summary)}`
  );

  bot.sendMessage(userProfile, [array_msg, summary_msg]);

  return;
};
