import express from "express";
import mongoose from "mongoose";
import ngrok from "./utils/getPublicUrl.js";
import pkg from "viber-bot";
const { Bot, Events, Message } = pkg;

import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);

import dotenv from "dotenv";
dotenv.config();

import dataRoutes from "./routes/data.js";

export const bot = new Bot({
  authToken: process.env.AUTH_TOKEN,
  name: "PHL GS Bot",
  avatar:
    "https://www.pexels.com/photo/turned-on-monitor-displaying-frequency-graph-241544/", // It is recommended to be 720x720, and no more than 100kb.
});

import { createUser, findUser } from "./controllers/users.js";
import {
  dealtUpdateLogic,
  fetchHistoricalPricesLogic,
  fetchPriceInfoLogic,
  fetchSummariesLogic,
  fetchTimeAndSalesLogic,
  offPricesLogic,
  pricesUpdateLogic,
} from "./botlogic/updates.js";
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
import {
  getValidSeries,
  getSeries,
  getTenor,
  updateIsins,
} from "./controllers/isins.js";
import {
  getValidNicknames,
  getDesk,
  getValidDesks,
} from "./controllers/desks.js";
import {
  formatPrice,
  getBroker,
  formatTime,
  getBrokers,
  getTotalVol,
} from "./utils/updates.js";

import {
  getAdminDealtUpdateRegex,
  getAdminPricesUpdateRegex,
  getFetchPriceInfoRegex,
  getCreateOrderRegex,
  getShowOrdersRegex,
  getOffOrdersRegex,
  getPendingDealtOrderRegex,
  getFetchHistoricalPricesRegex,
  getFetchTimeAndSalesRegex,
  getFetchSummariesRegex,
  getOffPricesRegex,
  getUploadTimeAndSalesRegex,
  getUpdateISINsRegex,
} from "./utils/regex.js";
import { updateAdmins, updateUsers } from "./botlogic/broadcast.js";

import {
  getTimeAndSalesCSV,
  uploadTimeAndSalesCSV,
} from "./controllers/timeAndSales.js";

import { test_job, toggle_job, get_job_status } from "./controllers/cron.js";

// SETTINGS
const settings = { online: false, update_users: false };

// populateIsins();
const time_and_sales_func = (res) => {
  const { deals } = res;
  if (deals) {
    const last_deal = deals[0].value;
    console.log("last_deal: ", last_deal);
    console.log("last_deal.time: ", last_deal.time);
    const time = dayjs(last_deal.time).format("h:mm A");
    const date = dayjs(last_deal.time).format("MM/DD/YY");
    console.log("time: ", time);
    const total_vol = getTotalVol(deals.map((deal) => deal.value));
    console.log("total_vol: ", total_vol);
    // add total vol to this
    const spiel = `Time and sales updated as of:\n${time}, ${date}\n${deals.length} deals added\nTotal vol: ${total_vol} Mn`;
    updateAdmins(spiel);
    if (settings.update_users) updateUsers("time_and_sales", spiel);
  }
};
// uploadTimeAndSales("01-28-2022").then(time_and_sales_func);

// fetchSummary();

const testing = async () => {
  // updateIsins();
  // getTimeAndSalesCSV("2022-03-11");
};

// YYYY-MM-DD
// testing();

// gets called the first time a user opens the chat
// use this as a way to register (if not already registered)
bot.onConversationStarted(
  async (userProfile, isSubscribed, context, onFinish) => {
    console.log("userProfile: ", userProfile);
    console.log("isSubscribed: ", isSubscribed);

    const user = await findUser(userProfile.id);
    console.log("user: ", user);

    if (!user) {
      // Step 1: if this is a user's first prompt, this will be a subtle way to register them and create their users
      console.log("user doesn't exist");
      onFinish(
        new Message.Text(
          `Hi, ${userProfile.name}! Nice to meet you. Please type "register" to register as a user.`
        )
      );
    } else {
      // if user already exists
      console.log("user exists");
      console.log("user: ", user);

      let intro = [
        new Message.Text(`Hi, ${user.name}! How may I help you today?`),
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
  const { userProfile } = response;
  console.log("userProfile: ", userProfile);
  const user = await findUser(userProfile.id);
  console.log("user: ", user);
  const { text } = message;
  console.log("text: ", text);

  if (user) {
    updateAdmins(`${user.name} sent a message:\n\n${text}`);
  } else {
    updateAdmins(
      `${userProfile.name} (unregistered) sent a message:\n\n${text}`
    );
  }

  const validSeries = await getValidSeries();

  const validNicknames = await getValidNicknames();

  const validDesks = await getValidDesks();

  // Check if there are PendingQueries tied to that user
  // While there are PendingQueries, those queries have to be answered before normal functions can be carried out
  const pending = await checkPendingQueries(user);

  if (/^cron status$/i.test(text)) {
    const job_status = get_job_status();
    updateAdmins(job_status);

    return;
  }

  if (/^cron test$/i.test(text)) {
    const toggle_result = toggle_job();
    updateAdmins(toggle_result);

    return;
  }

  // check if valid command
  if (!validCommand(text, validSeries, validNicknames, validDesks, pending)) {
    const reply = new Message.Text(
      `Sorry, I don't recognize that command. Please type "help" for available commands`
    );
    response.send(reply);

    return;
  }

  console.log("register regex: ", /^register/gi.test(text));
  if (/^register/gi.test(text)) {
    if (user) {
      bot.sendMessage(userProfile, [
        new Message.Text(
          `Hi, ${user.name}! You're already registered as a${
            user.role === "admin" ? "n" : ""
          } ${user.role}.`
        ),
      ]);
    } else {
      bot.sendMessage(userProfile, [
        new Message.Text(
          `Hi, ${userProfile.name}! Are you a dealer? Or a broker?`
        ),
      ]);
    }

    return;
  }

  // Step 2: when initially registering and the user responds w/ the correct response (admin/dealer/broker)
  if (!user && /^((admin)|(broker)|(dealer))/gi.test(text)) {
    const role = text.toLowerCase();
    const reply = new Message.Text(
      `Got it ${userProfile.name}, you're a${
        role === "admin" ? "n" : ""
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

  if (/^help/gi.test(text)) {
    // check if the user is registered
    if (!user) {
      // if the user isn't registered, ask them to register
      bot.sendMessage(userProfile, [
        new Message.Text(
          `Hi, ${user.name}! Nice to meet you. It seems you aren't registered. Are you a dealer, or a broker?`
        ),
      ]);
      // if the user is registered, show them help spiel
    } else {
      const intro = new Message.Text(
        `Hi, ${user.name}! Looks like you're a${
          user.role === "admin" ? "n" : ""
        } ${user.role}. Here's what you can do: `
      );
      if (user.role === "dealer") {
        console.log("user.role === dealer");
        bot.sendMessage(userProfile, [intro, ...dealerSpiel]);
      }

      if (user.role === "broker") {
        bot.sendMessage(userProfile, brokerSpiel);
      }

      if (user.role === "admin") {
        bot.sendMessage(userProfile, [intro, ...adminSpiel]);
      }
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

  // REGEX
  const pricesUpdateRegex = getAdminPricesUpdateRegex(validSeries);

  const dealtUpdateRegex = getAdminDealtUpdateRegex(validSeries);

  const fetchPriceInfoRegex = getFetchPriceInfoRegex(validSeries);

  const offPricesRegex = getOffPricesRegex(validSeries);

  const fetchHistoricalPricesRegex = getFetchHistoricalPricesRegex(validSeries);

  const uploadTimeAndSalesRegex = getUploadTimeAndSalesRegex();

  const updateISINsRegex = getUpdateISINsRegex();

  const fetchTimeAndSalesRegex = getFetchTimeAndSalesRegex(validSeries);

  const fetchSummariesRegex = getFetchSummariesRegex();

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

  // Admin functions
  if (user.role === "admin") {
    // Create bid offer update
    if (pricesUpdateRegex.test(text)) {
      console.log(`regex triggered: pricesUpdateRegex.test(text)`);
      const match = text.match(pricesUpdateRegex);

      const messages = await pricesUpdateLogic(userProfile, match, user);

      for (const message of messages) {
        updateAdmins(message);
        if (settings.update_users) updateUsers("prices", message);
      }

      return;
    }

    if (offPricesRegex.test(text)) {
      console.log("regex triggered: offPricesRegex");
      const match = text.match(offPricesRegex);

      const message = await offPricesLogic(userProfile, match, user);

      updateAdmins(message);

      return;
    }

    // Create last dealt update
    if (dealtUpdateRegex.test(text)) {
      console.log(`regex triggered: dealtUpdateRegex.test(text)`);
      console.log("text.match: ", text.match(dealtUpdateRegex));
      const match = text.match(dealtUpdateRegex);

      const messages = await dealtUpdateLogic(userProfile, match, user);

      for (const message of messages) {
        updateAdmins(message);
        if (settings.update_users) updateUsers("prices", message);
      }

      return;
    }

    // Fetch price info
    if (fetchPriceInfoRegex.test(text)) {
      console.log("regex triggered: fetchPriceInfoRegex");
      // if it matches this format, get the list of series' requested by splitting the original string by spaces
      const string = text.match(fetchPriceInfoRegex)[0];
      console.log("string: ", string);
      const list = text.split(/\s+/);
      console.log("list: ", list);

      await fetchPriceInfoLogic(userProfile, list);

      return;
    }

    // Fetch historical prices
    if (fetchHistoricalPricesRegex.test(text)) {
      console.log(`regex triggered: fetchHistoricalPricesRegex.test(text)`);
      const match = text.match(fetchHistoricalPricesRegex);
      console.log("match: ", match);

      await fetchHistoricalPricesLogic(userProfile, match);

      return;
    }

    // Fetching time and sales
    if (fetchTimeAndSalesRegex.test(text)) {
      console.log(`regex triggered: fetchTimeAndSalesRegex.test(text)`);
      const match = text.match(fetchTimeAndSalesRegex);
      console.log("match: ", match);

      await fetchTimeAndSalesLogic(userProfile, match);

      return;
    }

    if (updateISINsRegex.test(text)) {
      const res = await updateIsins();
      let msg = null;
      if (Array.isArray(res) && res.length > 0) {
        msg = `ISINs uploaded: ${res.join(", ")}`;
      } else {
        msg = `Error uploading ISINs: ${msg}`;
      }
      updateAdmins(msg);
    }

    if (uploadTimeAndSalesRegex.test(text)) {
      console.log(`regex triggered: uploadTimeAndSalesRegex.test(text)`);
      const match = text.match(uploadTimeAndSalesRegex);
      console.log("match: ", match);

      let date = null;

      if (match[1]) {
        // reformat date to YYYY-MM-DD
        date = dayjs(match[1], ["MM/DD", "MM/DD/YYYY"], true).format(
          "YYYY-MM-DD"
        );
      }

      const res = await getTimeAndSalesCSV(date);
      if (!res.trades_with_series) {
        updateAdmins(res);
        return;
      }

      if (res.trades_with_series.length < 1) {
        updateAdmins(res.message);
        return;
      }

      if (res.invalidIsins.length > 0)
        updateAdmins(`Invalid isins: ${res.invalidIsins.join(", ")}`);
      // if there's an invalid isin, notify the admin
      // but then continue to upload the rest

      const { spiel, uploaded_trades } = await uploadTimeAndSalesCSV(
        res.trades_with_series
      );

      updateAdmins(spiel);

      if (settings.update_users) updateUsers("time_and_sales", spiel);
      return;
    }

    // Fetching summaries
    if (fetchSummariesRegex.test(text)) {
      console.log(`regex triggered: fetchSummariesRegex.test(text)`);
      const match = text.match(fetchSummariesRegex);
      console.log("match: ", match);

      await fetchSummariesLogic(userProfile, match);

      return;
    }

    // Creating orders
    if (createOrderRegex.test(text)) {
      console.log("regex triggered: createOrderRegex");
      console.log("text.match: ", text.match(createOrderRegex));
      const match = text.match(createOrderRegex);
      const [full, seriesInput, nickname, orderType, rate, volume, broker] =
        match;

      const series = await getSeries(seriesInput);
      console.log("series: ", series);
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
        series,
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
          `Order created for ${desk}\n\n${series} ${orderType}ing at ${formattedRate} for ${formattedVol} Mn on ${formattedBroker}`
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

    // Offing orders
    if (offOrdersRegex.test(text)) {
      console.log("regex triggered: offOrdersRegex");
      console.log("text.match: ", text.match(offOrdersRegex));
      const match = text.match(offOrdersRegex);
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
    // Fetch price info

    if (fetchPriceInfoRegex.test(text)) {
      console.log("regex triggered: fetchPriceInfoRegex");
      // if it matches this format, get the list of series' requested by splitting the original string by spaces
      const string = text.match(fetchPriceInfoRegex)[0];
      console.log("string: ", string);
      const list = text.split(/\s+/);
      console.log("list: ", list);

      await fetchPriceInfoLogic(userProfile, list);

      return;
    }

    // Fetch historical prices
    if (fetchHistoricalPricesRegex.test(text)) {
      console.log(`regex triggered: fetchHistoricalPricesRegex.test(text)`);
      const match = text.match(fetchHistoricalPricesRegex);
      console.log("match: ", match);

      await fetchHistoricalPricesLogic(userProfile, match);

      return;
    }

    // Fetching time and sales
    if (fetchTimeAndSalesRegex.test(text)) {
      console.log(`regex triggered: fetchTimeAndSalesRegex.test(text)`);
      const match = text.match(fetchTimeAndSalesRegex);
      console.log("match: ", match);

      await fetchTimeAndSalesLogic(userProfile, match);

      return;
    }

    // Fetching summaries
    if (fetchSummariesRegex.test(text)) {
      console.log(`regex triggered: fetchSummariesRegex.test(text)`);
      const match = text.match(fetchSummariesRegex);
      console.log("match: ", match);

      await fetchSummariesLogic(userProfile, match);

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

const port = process.env.PORT || 3000;

const app = express();

app.use("/viber/webhook", bot.middleware());

app.get("/", (req, res) => {
  res.send("BPI app online");
});

app.use("/api/data", dataRoutes);

// CHANGE THIS WHEN TESTING LOCALLY/ON HEROKU
const connection = process.env.MONGODB_ATLAS;

// mongodb+srv://baltiearaneta:mongoBaltie123@cluster0.c7tdl.mongodb.net/bpi-app?retryWrites=true&w=majority

console.log("connection: ", connection);

mongoose
  .connect(connection, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Now connected to MongoDB"))
  .catch((error) => console.log("Error connecting to MongoDB: ", error));

app.listen(port, async () => {
  // CHANGE THIS WHEN TESTING LOCALLY/ON HEROKU
  try {
    const online = settings.online; // if testing locally, toggle this to false; else true if deployed on heroku
    const herokuUrl = "https://phl-gs-chatbot-app.herokuapp.com";
    const webhookUrl = online ? herokuUrl : await ngrok();
    console.log("webhookUrl: ", webhookUrl);

    // Setting the webhook will be done by calling the set_webhook API with a valid & certified URL.
    // Once a set_webhook request is sent Viber will send a callback to the webhook to check its availability and return a response to the user. (https://developers.viber.com/docs/api/rest-bot-api/#get-started)
    console.log("setting webhook to this url: ", `${webhookUrl}/viber/webhook`);
    const res = await bot.setWebhook(`${webhookUrl}/viber/webhook`);
    console.log(`Bot API is now online on port ${port}`);
    console.log("res: ", res);
  } catch (err) {
    console.error(err);
    console.log("Cannot set webhook on following server. Is it running?");
  }
});
