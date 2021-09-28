import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ngrok from "./utils/getPublicUrl.js";
import pkg from "viber-bot";
import dayjs from "dayjs";
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
import { formatPrice, getBroker } from "./utils/updates.js";
import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
} from "./utils/regex.js";

// populate();/
// getValidIsins().then((res) => console.log(res));
// getSeries("r513");

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

  // check if valid command
  if (!validCommand(text, validIsins)) {
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

  // Logic for creating price updates
  if (user.role === "admin") {
    const pricesUpdateRegex = getAdminPricesUpdateRegex(validIsins);

    const dealtUpdateRegex = getAdminDealtUpdateRegex(validIsins);

    const fetchPriceInfoRegex = getFetchPriceInfoRegex(validIsins);
    console.log("fetchPriceInfoRegex: ", fetchPriceInfoRegex);

    if (pricesUpdateRegex.test(text)) {
      console.log("text.match: ", text.match(pricesUpdateRegex));
      const match = text.match(pricesUpdateRegex);
      const [full, series, bid, offer, bidvol, offervol, broker] = match;

      const formattedSeries = await getSeries(series);
      const formattedBid = formatPrice(bid);
      console.log("formattedBid: ", formattedBid);
      const formattedOffer = formatPrice(offer);
      console.log("formattedOffer: ", formattedOffer);
      const formattedBroker = getBroker(broker);

      const update = await createPricesUpdate({
        series: formattedSeries,
        bid: formattedBid,
        offer: formattedOffer,
        bidvol: bidvol === "na" ? null : bidvol,
        offervol: offervol === "na" ? null : offervol,
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
      console.log("text.match: ", text.match(dealtUpdateRegex));
      const match = text.match(dealtUpdateRegex);
      const [full, series, action, price, volume, broker] = match;

      const formattedSeries = await getSeries(series);
      const formattedPrice = formatPrice(price);
      const formattedBroker = getBroker(broker);

      console.log("series: ", formattedSeries);
      console.log("action: ", action);
      console.log("price: ", formattedPrice);
      console.log("broker: ", formattedBroker);

      const update = await createDealtUpdate({
        series: formattedSeries,
        price: formattedPrice,
        action,
        volume,
        broker: formattedBroker,
        user,
      });

      console.log("update: ", update);

      const time = dayjs().format("h:mm:ss A");

      bot.sendMessage(userProfile, [
        new Message.Text(
          `${formattedSeries} was ${action} at ${formattedPrice} for ${volume} Mn \n\non ${formattedBroker} at ${time}`
        ),
      ]);

      return;
    }

    if (fetchPriceInfoRegex.test(text)) {
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

      console.log("results: ", results);

      // send an update for each series

      for (const result of results) {
        // if there are more than one best bids/offers
        let bidBreakdown = ``;
        let offerBreakdown = ``;

        const multipleBestBids =
          result.bestBidVols.length > 1 && result.bestBidBrokers.length > 1;

        if (multipleBestBids) {
          result.bestBidVols.forEach((bidVol, index) => {
            bidBreakdown =
              bidBreakdown +
              `   ${result.bestBidBrokers[index]} - ${bidVol} Mn \n`;
          });
        }

        const multipleBestOffers =
          result.bestOfferVols.length > 1 && result.bestOfferBrokers.length > 1;

        if (multipleBestOffers) {
          result.bestOfferVols.forEach((offerVol, index) => {
            offerBreakdown =
              offerBreakdown +
              `   ${result.bestOfferBrokers[index]} - ${offerVol} Mn \n`;
          });
        }

        function add(accumulator, a) {
          return accumulator + a;
        }

        bot.sendMessage(userProfile, [
          new Message.Text(
            `${result.series}\n\nBest bid: ${
              !result.bestBid
                ? "none"
                : `${result.bestBid} for ${result.bestBidVols.reduce(
                    add,
                    0
                  )} Mn\n${
                    multipleBestBids
                      ? bidBreakdown
                      : `   on ${result.bestBidBrokers[0]}`
                  }`
            }\nBest offer: ${
              !result.bestOffer
                ? "none"
                : `${result.bestOffer} for ${result.bestOfferVols.reduce(
                    add,
                    0
                  )} Mn\n${
                    multipleBestOffers
                      ? offerBreakdown
                      : `   on ${result.bestOfferBrokers[0]}`
                  }`
            }`
          ),
        ]);
      }

      return;
    }
  } else if (user.role === "broker") {
  }

  // Logic for reading price updates

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

const connection = "mongodb://localhost:27017/bpi-app";

mongoose
  .connect(connection, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Now connected to MongoDB"))
  .catch((error) => console.log(error));

app.listen(port, async () => {
  const local = true; // if testing locally, toggle this to true; else false if deployed on heroku
  const herokuUrl = "https://phl-gs-chatbot-app.herokuapp.com/";
  const webhookUrl = local ? await ngrok() : herokuUrl;

  try {
    // Setting the webhook will be done by calling the set_webhook API with a valid & certified URL.
    // Once a set_webhook request is sent Viber will send a callback to the webhook to check its availability and return a response to the user. (https://developers.viber.com/docs/api/rest-bot-api/#get-started)
    const res = await bot.setWebhook(`${webhookUrl}/viber/webhook`);
    console.log(`Bot API is now online on port ${port}`);
    console.log("res: ", res);
  } catch (err) {
    console.log("Cannot set webhook on following server. Is it running?");
    console.error(err);
  }
});
