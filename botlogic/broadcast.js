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

import { fetchAdmins, fetchDealers } from "../controllers/users.js";
import { broadcastMessage } from "../utils/messages.js";

export const updateAdmins = async (text) => {
  try {
    console.log("in updateAdmins controller");
    const admins = await fetchAdmins();
    console.log("admins: ", admins);
    if (admins.length > 0) {
      console.log("admins.length > 0");
      const adminViberIds = admins.map((admin) => admin.viberId);
      console.log("adminViberIds: ", adminViberIds);
      await broadcastMessage(adminViberIds, text);
    }
  } catch (err) {
    return err;
  }
};

export const updateUsers = async (type, text) => {
  try {
    console.log("in updateUsers controller");
    console.log("type: ", type);

    let options = {
      updates: {},
    };

    const valid_types = ["time_and_sales", "prices"];
    if (!valid_types.includes(type)) throw "Not a valid type";

    options.updates[type] = true;

    console.log("options: ", options);

    const users_to_update = await fetchDealers(options);
    console.log("users_to_update: ", users_to_update);

    if (users_to_update.length > 0) {
      console.log("users_to_update.length > 0");
      const viber_ids = users_to_update.map((user) => user.viberId);
      console.log("viber_ids: ", viber_ids);
      await broadcastMessage(viber_ids, text);
    }
  } catch (err) {
    console.log("error in updateUsers: ", err);
    return err;
  }
};
