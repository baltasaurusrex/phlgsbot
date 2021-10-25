import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ngrok from "./utils/getPublicUrl.js";
import pkg from "viber-bot";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);
const { Bot, Events, Message } = pkg;
dotenv.config();

import { createUser, findUser } from "./controllers/users.js";
import {
  createPricesUpdate,
  createDealtUpdate,
  fetchPricingData,
} from "./controllers/updates.js";
import {
  createOrder,
  fetchOrders,
  offOrders,
  fillOrder,
} from "./controllers/orders.js";
import {
  checkPendingQueries,
  completePendingQuery,
  createPendingQuery,
} from "./controllers/pendingQueries.js";
import { validCommand } from "./utils/validation.js";
import { dealerSpiel, brokerSpiel, adminSpiel } from "./utils/spiel.js";
import { broadcastMessage } from "./utils/messages.js";
import { renderOrder } from "./utils/orders.js";
import { populateIsins } from "./populators/isins.js";
import { uploadTimeAndSales } from "./populators/timeAndSales.js";
import { getValidSeries, getSeries } from "./controllers/isins.js";
import {
  getValidNicknames,
  getDesk,
  getValidDesks,
} from "./controllers/desks.js";
import { formatPrice, getBroker, formatTime } from "./utils/updates.js";

import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
  getShowOrdersRegex,
  getOffOrdersRegex,
  getPendingDealtOrderRegex,
} from "./utils/regex.js";

// populateIsins();
// uploadTimeAndSales("10-25-2021").then((res) => console.log(res));

export const bot = new Bot({
  authToken: process.env.AUTH_TOKEN,
  name: "PHL GS Bot",
  avatar:
    "https://www.pexels.com/photo/turned-on-monitor-displaying-frequency-graph-241544/", // It is recommended to be 720x720, and no more than 100kb.
});

// gets called the first time a user opens the chat
// use this as a way to register (if not already registered)
bot.onConversationStarted(
  async (userProfile, isSubscribed, context, onFinish) => {
    console.log("userProfile: ", userProfile);
    console.log("isSubscribed: ", isSubscribed);
    console.log("context: ", context);

    const user = await findUser(userProfile.id);
    console.log("user: ", user);

    if (!user) {
      // Step 1: if this is a user's first prompt, this will be a subtle way to register them and create their users
      console.log("user doesn't exist");
      onFinish(
        new Message.Text(
          `Hi, ${userProfile.name}! Nice to meet you. Are you a dealer, or a broker?`
        )
      );
    } else {
      // if user already exists
      console.log("user exists");
      console.log("user: ", user);

      let intro = [
        new Message.Text(`Hi, ${userProfile.name}! How may I help you today?`),
        new Message.Text(`Please type "help" for available commands`),
      ];

      bot.sendMessage(userProfile, intro);
    }
  }
);

bot.onSubscribe((response) => {
  console.log("response: ", response);
  console.log(`Subscribed: ${response.userProfile.name}`);
});

bot.onUnsubscribe((userId) => {
  console.log(`Unsubscribed: ${userId}`);
});

// for any messages from the user
bot.on(Events.MESSAGE_RECEIVED, async (message, response) => {
  console.log("message: ", message);
  const { text } = message;
  console.log("text: ", text);

  console.log("response: ", response);
  const { userProfile } = response;
  console.log("userProfile: ", userProfile);

  const user = await findUser(userProfile.id);
  console.log("user: ", user);

  const validSeries = await getValidSeries();
  console.log("validSeries: ", validSeries);

  const validNicknames = await getValidNicknames();
  console.log("validNicknames: ", validNicknames);

  const validDesks = await getValidDesks();
  console.log("validDesks: ", validDesks);

  // Check if there are PendingQueries tied to that user
  // While there are PendingQueries, those queries have to be answered before normal functions can be carried out
  const pending = await checkPendingQueries(user);

  // check if valid command
  if (!validCommand(text, validSeries, validNicknames, validDesks, pending)) {
    const reply = new Message.Text(
      `Sorry, I don't recognize that command. Please type "help" for available commands`
    );
    response.send(reply);

    return;
  }

  // if the user types "help"
  if (/^help/gi.test(text)) {
    // check if the user is registered
    if (!user) {
      // if the user isn't registered, ask them to register
      bot.sendMessage(userProfile, [
        new Message.Text(
          `Hi, ${userProfile.name}! Nice to meet you. It seems you aren't registered. Are you a dealer, or a broker?`
        ),
      ]);
      // if the user is registered, show them help spiel
    } else {
      if (user.role === "dealer") {
        bot.sendMessage(userProfile, dealerSpiel);
      }

      if (user.role === "broker") {
        bot.sendMessage(userProfile, brokerSpiel);
      }

      if (user.role === "admin") {
        bot.sendMessage(userProfile, adminSpiel);
      }
    }
    return;
  }

  // Step 2: when initially registering and the user responds w/ the correct response (admin/dealer/broker)
  if (!user && /^((admin)|(broker)|(dealer))/gi.test(text)) {
    const role = text.toLowerCase();
    const reply = new Message.Text(
      `Got it ${userProfile.name}, you're a${
        role === "admin" ? "n" : null
      } ${role}.`
    );
    response.send(reply);

    if (role === "dealer") {
      bot.sendMessage(userProfile, dealerSpiel);
      createUser(userProfile, role).then((res) =>
        console.log("user created: ", res)
      );
    }

    if (role === "broker") {
      bot.sendMessage(userProfile, brokerSpiel);
      createUser(userProfile, role).then((res) =>
        console.log("user created: ", res)
      );
    }

    if (role === "admin") {
      bot.sendMessage(userProfile, adminSpiel);
      createUser(userProfile, role).then((res) =>
        console.log("user created: ", res)
      );
    }

    return;
  }

  console.log("pending: ", pending);

  // If there are PendingQueries, answer them first:
  if (pending.length > 0) {
    const pendingDealtOrderRegex = getPendingDealtOrderRegex();

    // if the user has already responded to a pending query with yes/no etc:
    if (pendingDealtOrderRegex.test(text)) {
      console.log(`regex triggered: pendingDealtOrderRegex.test(text)`);
      const match = text.match(pendingDealtOrderRegex);
      console.log("match: ", match);
      const [fullInput, yesOrNoInput, volumeInput] = match;

      const yn = yesOrNoInput.slice(0, 1).toLowerCase();

      // if "y", update orders by the vol
      // note, a "last_dealt" update was already created at this point, so only need to update the Orders collection
      if (yn === "y") {
        const update = await fillOrder(pending[0].attachment, volumeInput);

        const renderCompleted = (pendingQuery) => {
          if (pendingQuery.type === "dealt_order") {
            console.log("pendingQuery: ", pendingQuery);
            const attachment = pendingQuery.attachment;
            const argObj = {
              series: attachment.series,
              orderType: attachment.orderType,
              rate: attachment.rate,
              broker: attachment.broker,
              forDesk: attachment.forDesk,
              vol: volumeInput,
            };
            console.log("argObj: ", argObj);
            return `Order filled: \n\n${renderOrder(argObj)}\n`;
          }
        };

        bot.sendMessage(userProfile, [
          new Message.Text(`${renderCompleted(pending[0])}`),
        ]);
      } else if (yn === "n" && pending.length > 1) {
        // if "no", and if there is a next one, render it
        const renderPending = (item) => {
          if (item.type === "dealt_order") {
            return `Has this order been dealt?\n\n${renderOrder(
              item.attachment
            )}`;
          }
        };

        bot.sendMessage(userProfile, [
          new Message.Text(`${renderPending(pending[1])}`),
        ]);
        return;
      } else {
        // just show the orders

        const orders = await fetchOrders();
        console.log("orders: ", orders);

        bot.sendMessage(userProfile, [
          new Message.Text(
            `Outstanding orders: \n\n${
              orders.length > 0
                ? orders?.map((order) => renderOrder(order)).join("")
                : "No orders"
            }`
          ),
        ]);
      }

      const completedQuery = await completePendingQuery(pending[0]);
      console.log("completedQuery: ", completedQuery);

      return;
    }

    const renderPending = (item) => {
      if (item.type === "dealt_order") {
        return `Has this order been dealt?\n\n${renderOrder(item.attachment)}`;
      }
    };

    bot.sendMessage(userProfile, [
      new Message.Text(`${renderPending(pending[0])}`),
    ]);
    return;
  }

  // Admin functions
  if (user.role === "admin") {
    const pricesUpdateRegex = getAdminPricesUpdateRegex(validSeries);

    const dealtUpdateRegex = getAdminDealtUpdateRegex(validSeries);

    const fetchPriceInfoRegex = getFetchPriceInfoRegex(validSeries);

    const createOrderRegex = getCreateOrderRegex(validSeries, validNicknames);

    const showOrdersRegex = getShowOrdersRegex(
      validSeries,
      validDesks,
      validNicknames
    );

    const offOrdersRegex = getOffOrdersRegex(
      validSeries,
      validDesks,
      validNicknames
    );

    if (pricesUpdateRegex.test(text)) {
      console.log(`regex triggered: pricesUpdateRegex.test(text)`);
      const match = text.match(pricesUpdateRegex);
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

      console.log("bid: ", bid);
      console.log("offer: ", offer);

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

      const update = await createPricesUpdate({
        series,
        bid,
        offer,
        bid_vol,
        offer_vol,
        broker,
        user,
      });

      console.log("update: ", update);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `${update.series} prices created\n\nBid: ${
            !update.bid ? "none" : `${update.bid} for ${update.bid_vol} Mn`
          } \nOffer: ${
            !update.offer
              ? "none"
              : `${update.offer} for ${update.offer_vol} Mn`
          }\non ${update.broker}`
        ),
      ]);

      return;
    }

    // Last dealt
    if (dealtUpdateRegex.test(text)) {
      console.log(`regex triggered: dealtUpdateRegex.test(text)`);
      console.log("text.match: ", text.match(dealtUpdateRegex));
      const match = text.match(dealtUpdateRegex);
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

      // Look for possible existing orders on that series, at that price, and on that broker (across all desks)
      const desk = undefined;
      const possibleOrders = await fetchOrders(series, price, desk, broker);
      console.log("possibleOrders: ", possibleOrders);

      // If possible orders exist
      if (possibleOrders.length > 0) {
        // create PendingQueries for each of them
        const results = await Promise.allSettled(
          possibleOrders.map(
            async (order) => await createPendingQuery(user, order)
          )
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
        // bot.sendMessage(userProfile, [
        //   new Message.Text(
        //     `Has this order been dealt?\n\n${possibleOrders
        //       ?.map((order) => renderOrder(order))
        //       .join("")}`
        //   ),
        // ]);

        return;
      }

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

      return;
    }

    if (fetchPriceInfoRegex.test(text)) {
      console.log("regex triggered: fetchPriceInfoRegex");
      // if it matches this format, get the list of series' requested by splitting the original string by spaces
      const string = text.match(fetchPriceInfoRegex)[0];
      console.log("string: ", string);
      const list = text.split(/\s+/);
      console.log("list: ", list);

      const formattedList = await Promise.all(
        list.map(
          async (unformattedSeries) => await getSeries(unformattedSeries)
        )
      );

      console.log("formattedList: ", formattedList);

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
            if (
              bestBidOffer.bestOffer &&
              bestBidOffer.bestOfferVols.length >= 0
            ) {
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

          const fromNow = `${dayjs(lastDealt.time).fromNow()}`;

          return `\n\nlast ${lastDealt.direction} at ${lastDealt.lastDealt} for ${lastDealt.lastDealtVol} Mn\n${timestamp} ${fromNow}`;
        };

        const renderPrevLastDealt = () => {
          if (!prevLastDealt && !lastDealt) return "";

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

          console.log("timeNow: ", timeNow);
          console.log("timePrev: ", timePrev);

          const timeFrom = dayjs(timeNow).to(dayjs(timePrev));
          const fromNow = `${dayjs(timePrev).fromNow()}`;

          return `\n${
            signToShow ? signToShow : ""
          }${bpsDiff} bps from ${fromNow}`;
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
              const timestamp = `last updated ${dayjs(quote.created_at).format(
                "h:mm A"
              )}`;

              const renderBid = () => {
                if (quote.bid && quote.bid_vol) {
                  const bestBid = bestBidOffer.bestBid === quote.bid;
                  return `${bestBid ? "*" : ""}${quote.bid_vol} Mn ${
                    quote.bid
                  }${bestBid ? "*" : ""}`;
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
    }

    if (createOrderRegex.test(text)) {
      console.log("regex triggered: createOrderRegex");
      console.log("text.match: ", text.match(createOrderRegex));
      const match = text.match(createOrderRegex);
      const [full, series, nickname, orderType, rate, volume, broker] = match;

      const formattedSeries = await getSeries(series);
      console.log("formattedSeries: ", formattedSeries);
      const aliasOrId =
        nickname.toLowerCase() === "i" ? user._id : nickname.toLowerCase();
      const formattedOrderType =
        orderType.toLowerCase() === "pay" ? "bid" : "offer";
      const formattedRate = formatPrice(rate);
      const formattedVol = volume ? volume : 50;
      const formattedBroker = getBroker(broker);

      const desk = await getDesk(aliasOrId);

      const details = {
        creator: user._id,
        forDesk: desk,
        series: formattedSeries,
        orderType: formattedOrderType,
        rate: formattedRate,
        vol: formattedVol,
        broker: formattedBroker,
      };

      console.log("details: ", details);

      const order = await createOrder(details);

      console.log("order: ", order);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `Order created for ${desk}\n\n${formattedSeries} ${orderType}ing at ${formattedRate} for ${formattedVol} Mn on ${formattedBroker}`
        ),
      ]);

      // if an order is created, broadcast it to every other desk
      return;
    }

    // Show orders
    if (showOrdersRegex.test(text)) {
      console.log("regex triggered: showOrdersRegex");
      console.log("text.match: ", text.match(showOrdersRegex));
      const match = text.match(showOrdersRegex);
      const [full, seriesInput, deskOrAliasOrId, brokerInput] = match;
      const series = await getSeries(seriesInput);
      console.log("series: ", series);
      console.log("deskOrAliasOrId: ", deskOrAliasOrId);
      const desk = validDesks.includes(deskOrAliasOrId)
        ? deskOrAliasOrId
        : await getDesk(deskOrAliasOrId);
      console.log("desk: ", desk);
      const broker = brokerInput ? getBroker(brokerInput) : undefined;
      console.log("broker: ", broker);

      const rate = undefined;
      const orders = await fetchOrders(series, rate, desk, broker);
      console.log("orders: ", orders);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `${
            orders.length > 0
              ? orders?.map((order) => renderOrder(order)).join("")
              : "No orders"
          }`
        ),
      ]);
      return;
    }

    if (offOrdersRegex.test(text)) {
      console.log("regex triggered: offOrdersRegex");
      console.log("text.match: ", text.match(offOrdersRegex));
      const match = text.match(offOrdersRegex);
      const [full, series, deskOrAliasOrId, brokerInput] = match;
      console.log("series: ", series);
      console.log("deskOrAliasOrId: ", deskOrAliasOrId);
      const desk = validDesks.includes(deskOrAliasOrId)
        ? deskOrAliasOrId
        : await getDesk(deskOrAliasOrId);
      console.log("desk: ", desk);
      const broker = brokerInput ? getBroker(brokerInput) : undefined;
      console.log("broker: ", broker);

      const rate = undefined;
      const { ordersFound: ordersOffed, ordersDeleted: deleteManyReturnVal } =
        await offOrders(series, rate, desk, broker);
      console.log("ordersOffed: ", ordersOffed);
      console.log("deleteManyReturnVal: ", deleteManyReturnVal);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `Orders taken out\n\n${ordersOffed
            ?.map((order) => renderOrder(order))
            .join("")}`
        ),
      ]);
      return;
    }

    if (text === "test message") {
      console.log("testing message");
      const baltieViberId = "GLFVU5NMrftatUawMgsJug==";
      broadcastMessage([baltieViberId], "");
      return;
    }
  }

  // Dealer functions
  if (user.role === "dealer") {
    const fetchPriceInfoRegex = getFetchPriceInfoRegex(validSeries);
    console.log("fetchPriceInfoRegex: ", fetchPriceInfoRegex);

    if (fetchPriceInfoRegex.test(text)) {
      console.log("fetchPriceInfoRegex triggered");
      // if it matches this format, get the list of series' requested by splitting the original string by spaces
      const list = text.split(" ");
      console.log("list: ", list);

      const formattedList = await Promise.all(
        list.map(
          async (unformattedSeries) => await getSeries(unformattedSeries)
        )
      );

      console.log("formattedList: ", formattedList);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `Requesting for pricing data on ${formattedList.join(", ")}...`
        ),
      ]);

      let results = await Promise.all(
        formattedList.map(async (series) => await fetchPricingData(series))
      );

      for (const result of results) {
        const { series, quotes, bestBidOffer, lastDealt } = result;
        console.log("lastDealt: ", lastDealt);

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
            if (
              bestBidOffer.bestOffer &&
              bestBidOffer.bestOfferVols.length >= 0
            ) {
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
            lastDealt.created_at
          ).format("h:mm A")}`;

          return `\n\nlast *${lastDealt.direction}* at *${lastDealt.lastDealt}* for ${lastDealt.lastDealtVol} Mn\n${timestamp}`;
        };

        const renderBrokers = () => {
          if (quotes?.length === 0) {
            return "\n\nno levels";
          } else {
            const brokerString = quotes.map((quote) => {
              const timestamp = `last updated ${dayjs(quote.created_at).format(
                "h:mm A"
              )}`;

              const renderBid = () => {
                if (quote.bid && quote.bid_vol) {
                  const bestBid = bestBidOffer.bestBid === quote.bid;
                  return `${bestBid ? "*" : ""}${quote.bid_vol} Mn ${
                    quote.bid
                  }${bestBid ? "*" : ""}`;
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
            }*${renderBestPrices()}${renderLastDealt()}${renderBrokers()}`
          ),
        ]);
      }
      return;
    }

    if (createOrderRegex.test(text)) {
      console.log("regex triggered: createOrderRegex");
      console.log("text.match: ", text.match(createOrderRegex));
      const match = text.match(createOrderRegex);
      const [full, series, nickname, orderType, rate, volume, broker] = match;

      const formattedSeries = await getSeries(series);
      console.log("formattedSeries: ", formattedSeries);
      const aliasOrId =
        nickname.toLowerCase() === "i" ? user._id : nickname.toLowerCase();
      const formattedOrderType = orderType.toLowerCase();
      const formattedRate = formatPrice(rate);
      const formattedVol = volume ? volume : 50;
      const formattedBroker = getBroker(broker);

      console.log("before", formattedBroker);
      const desk = await getDesk(aliasOrId);
      console.log("after");

      // const details = {
      //   creator: user._id,
      //   for: desk,
      //   series: formattedSeries,
      //   orderType: formattedOrderType,
      //   rate: formattedRate,
      //   vol: formattedVol,
      //   broker: formattedBroker,
      // };

      // console.log("details: ", details);

      // const order = await createOrder(details);

      // console.log("order: ", order);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `Order created for ${desk}\n\n${formattedSeries} ${formattedOrderType}ing at ${formattedRate} for ${formattedVol} Mn on ${formattedBroker}`
        ),
      ]);

      // if an order is created, broadcast it to every other desk
      return;
    }
  }

  if (user.role === "broker") {
  }

  // Temporary catch all
  const reply = new Message.Text(
    `Hi ${userProfile.name}, with user id: ${userProfile.id}`
  );
  console.log("reply: ", reply);
  response.send(reply);
});

const port = process.env.PORT || 5000;

const app = express();

app.use("/viber/webhook", bot.middleware());

app.get("/", (req, res) => {
  res.send("BPI app online");
});

// CHANGE THIS WHEN TESTING LOCALLY/ON HEROKU
const connection = process.env.MONGODB_ATLAS;

mongoose
  .connect(connection, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Now connected to MongoDB"))
  .catch((error) => console.log(error));

app.listen(port, async () => {
  // CHANGE THIS WHEN TESTING LOCALLY/ON HEROKU
  const online = true; // if testing locally, toggle this to false; else true if deployed on heroku
  const herokuUrl = "https://phl-gs-chatbot-app.herokuapp.com";
  const webhookUrl = online ? herokuUrl : await ngrok();
  console.log("webhookUrl: ", webhookUrl);

  try {
    // Setting the webhook will be done by calling the set_webhook API with a valid & certified URL.
    // Once a set_webhook request is sent Viber will send a callback to the webhook to check its availability and return a response to the user. (https://developers.viber.com/docs/api/rest-bot-api/#get-started)
    console.log("setting webhook to this url: ", `${webhookUrl}/viber/webhook`);
    const res = await bot.setWebhook(`${webhookUrl}/viber/webhook`);
    console.log(`Bot API is now online on port ${port}`);
    console.log("res: ", res);
  } catch (err) {
    console.log("Cannot set webhook on following server. Is it running?");
    console.error(err);
  }
});
