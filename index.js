import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ngrok from "./utils/getPublicUrl.js";
import pkg from "viber-bot";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
const { Bot, Events, Message } = pkg;
dotenv.config();

import { createUser, findUser } from "./controllers/users.js";
import {
  createPricesUpdate,
  createDealtUpdate,
  fetchPricingData,
} from "./controllers/updates.js";
import { validCommand } from "./utils/validation.js";
import { dealerSpiel, brokerSpiel, adminSpiel } from "./utils/spiel.js";
import { populate } from "./populators/isins.js";
import { getValidIsins, getSeries } from "./controllers/isins.js";
import { getValidNicknames, getDesk } from "./controllers/desks.js";
import { formatPrice, getBroker, formatTime } from "./utils/updates.js";
import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
} from "./utils/regex.js";

// populate();

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

  const validIsins = await getValidIsins();
  console.log("validIsins: ", validIsins);

  const validNicknames = await getValidNicknames();
  console.log("validNicknames: ", validNicknames);

  // check if valid command
  if (!validCommand(text, validIsins, validNicknames)) {
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
  if (/^((admin)|(broker)|(dealer))/gi.test(text)) {
    console.log("text: ", text);
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

  // Admin functions
  if (user.role === "admin") {
    const pricesUpdateRegex = getAdminPricesUpdateRegex(validIsins);

    const dealtUpdateRegex = getAdminDealtUpdateRegex(validIsins);

    const fetchPriceInfoRegex = getFetchPriceInfoRegex(validIsins);

    const createOrderRegex = getCreateOrderRegex(validIsins, validNicknames);

    if (pricesUpdateRegex.test(text)) {
      console.log(`regex triggered: pricesUpdateRegex.test(text)`);

      console.log("text.match: ", text.match(pricesUpdateRegex));
      const match = text.match(pricesUpdateRegex);
      const [full, series, bid, offer, vol1, vol2, broker] = match;

      const formattedSeries = await getSeries(series);
      const formattedBid = formatPrice(bid);
      console.log("formattedBid: ", formattedBid);
      const formattedOffer = formatPrice(offer);
      console.log("formattedOffer: ", formattedOffer);
      console.log("vol1: ", vol1);
      console.log("vol2: ", vol2);
      const bidvol = formattedBid ? (vol1 ? vol1 : 50) : null;
      const offervol = formattedOffer
        ? formattedBid
          ? vol2
            ? vol2
            : 50
          : vol1
          ? vol1
          : 50
        : null;
      const formattedBroker = getBroker(broker);

      const update = await createPricesUpdate({
        series: formattedSeries,
        bid: formattedBid,
        offer: formattedOffer,
        bidvol,
        offervol,
        broker: formattedBroker,
        user,
      });

      console.log("update: ", update);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `${formattedSeries} prices created\n\nBid: ${
            !formattedBid ? "none" : `${formattedBid} for ${bidvol} Mn`
          } \nOffer: ${
            !formattedOffer ? "none" : `${formattedOffer} for ${offervol} Mn`
          }\non ${formattedBroker}`
        ),
      ]);

      return;
    }

    if (dealtUpdateRegex.test(text)) {
      console.log(`regex triggered: dealtUpdateRegex.test(text)`);
      console.log("text.match: ", text.match(dealtUpdateRegex));
      const match = text.match(dealtUpdateRegex);
      const [
        full,
        series,
        action,
        price,
        volume,
        broker,
        timeString,
        timePeriod,
      ] = match;

      console.log("match: ", match);

      const formattedSeries = await getSeries(series);
      const formattedPrice = formatPrice(price);
      const formattedVol = volume ? volume : 50;
      console.log("formattedVol: ", formattedVol);
      const formattedBroker = broker ? getBroker(broker) : "MOSB";
      const formattedTime =
        timeString && timePeriod
          ? formatTime(timeString, timePeriod)
          : dayjs().format();

      console.log("series: ", formattedSeries);
      console.log("action: ", action);
      console.log("price: ", formattedPrice);
      console.log("broker: ", formattedBroker);
      console.log("time: ", formattedTime);

      const update = await createDealtUpdate({
        series: formattedSeries,
        price: formattedPrice,
        action,
        volume: formattedVol,
        broker: formattedBroker,
        user,
        time: formattedTime,
      });

      console.log("update: ", update);

      const time = dayjs(update.time).format("h:mm A");

      bot.sendMessage(userProfile, [
        new Message.Text(
          `${formattedSeries} was ${action} at ${formattedPrice} for ${formattedVol} Mn \n\non ${formattedBroker} at ${time}`
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
      const aliasOrId = nickname === "i" ? user._id : nickname.toLowerCase();
      const formattedOrderType = orderType.toLowerCase();
      const formattedRate = formatPrice(rate);
      const formattedVol = volume ? volume : 50;
      const formattedBroker = getBroker(broker);

      const desk = await getDesk(aliasOrId);

      bot.sendMessage(userProfile, [
        new Message.Text(
          `Order created for ${desk}\n\n${formattedSeries} ${orderType}ing at ${formattedRate} for ${formattedVol} Mn on ${formattedBroker}`
        ),
      ]);
      return;
    }
  }

  // Dealer functions
  if (user.role === "dealer") {
    const fetchPriceInfoRegex = getFetchPriceInfoRegex(validIsins);
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
  }

  if (user.role === "broker") {
  }

  // Logic for creating orders

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
