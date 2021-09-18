import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import ngrok from "./utils/getPublicUrl.js";
import pkg from "viber-bot";
const { Bot, Events, Message } = pkg;
dotenv.config();

import { createUser } from "./controllers/users.js";

const bot = new Bot({
  authToken: process.env.AUTH_TOKEN,
  name: "PHL GS Bot",
  avatar:
    "https://www.pexels.com/photo/turned-on-monitor-displaying-frequency-graph-241544/", // It is recommended to be 720x720, and no more than 100kb.
});

bot.on(Events.MESSAGE_RECEIVED, (message, response) => {
  console.log("message: ", message);
  const { text } = message;
  console.log("response: ", response);
  const { userProfile } = response;
  const reply = new Message.Text(
    `Hi ${userProfile.name}, with user id: ${userProfile.id}`
  );
  console.log("reply: ", reply);
  response.send(reply);
});

bot.onConversationStarted((userProfile, isSubscribed, context, onFinish) => {
  console.log("userProfile: ", userProfile);
  console.log("isSubscribed: ", isSubscribed);
  console.log("context: ", context);

  let response = "";

  if (isSubscribed) {
    response = `Hi, ${userProfile.name}! How may I help you today?`;

    // check if user exists

    // if dealer
    if (user)
      bot.sendMessage(userProfile, [
        new Message.Text(
          `For updates on a specific ISIN, please type it's series`
        ),
        new Message.Text(`E.g. 577`),
        new Message.Text(`You may also type multiple series with one query`),
        new Message.Text(`E.g. 577 1061 765`),
        new Message.Text(
          "For updates on all tracked ISINs, please reply with 'all'"
        ),
      ]);
    // if broker
  } else {
    response = `Hi, ${userProfile.name}! Nice to meet you. Are you a dealer, or a broker?`;
  }

  onFinish(new Message.Text(response));
});

bot.onSubscribe((response) => {
  console.log("response: ", response);
  console.log(`Subscribed: ${response.userProfile.name}`);
});

const port = process.env.PORT || 5000;

const app = express();

app.use("/viber/webhook", bot.middleware());

app.get("/", (req, res) => {
  res.send("BPI app online");
});

app.listen(port, async () => {
  const publicUrl = await ngrok();

  bot.setWebhook(`${publicUrl}/viber/webhook`).catch((error) => {
    console.log("Can not set webhook on following server. Is it running?");
    console.error(error);
  });

  console.log(`Bot API is now online on port ${port}`);
});
