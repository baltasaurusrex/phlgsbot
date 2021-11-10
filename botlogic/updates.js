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

export const showBot = () => {
  console.log("bot: ", bot);
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
      priceDataString = `No good vol trades`;
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
