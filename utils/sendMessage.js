import axios from "axios";

const API = axios.create({
  baseURL: `https://chatapi.viber.com/pa`,
});

export const broadcastMessage = async (receiverViberIdList, text) => {
  try {
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
