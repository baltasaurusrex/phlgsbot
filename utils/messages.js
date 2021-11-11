import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API = axios.create({
  baseURL: `https://chatapi.viber.com/pa`,
  headers: { "X-Viber-Auth-Token": process.env.AUTH_TOKEN },
});

export const broadcastMessage = async (receiverViberIdList, text) => {
  try {
    console.log("in broadcastMessage");
    console.log("receiverViberIdList: ", receiverViberIdList);
    console.log("text: ", text);
    const data = await API.post(`/broadcast_message`, {
      broadcast_list: [...receiverViberIdList],
      type: "text",
      sender: {
        name: "PHL GS Bot",
      },
      text: text,
    });

    console.log("data: ", data);
  } catch (err) {
    console.log(`err:`, err);
  }
};
