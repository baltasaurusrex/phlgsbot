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

import { fetchAdmins } from "../controllers/users.js";
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
