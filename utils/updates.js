import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);

export const formatPrice = (price) => {
  console.log("price: ", price);
  const regex = new RegExp(`na|\\/`, "i");
  if (regex.test(price)) return null;
  const decimal = price.slice(0, 1) + "." + price.slice(1);

  const float = Number.parseFloat(decimal);

  const precise = Number.parseFloat(float.toPrecision(4));

  return precise;
};

export const getBroker = (code) => {
  if (!code) return "MOSB";

  const firstLetter = code.slice(0, 1);
  switch (firstLetter.toLowerCase()) {
    case "p":
      return "Prebon";
    case "a":
      return "Amstel";
    case "t":
      return "Tradition";
    case "g":
      return "GFI";
    default:
      return "MOSB";
  }
};

export const formatTime = (timeString, timePeriod) => {
  let formattedTimeString = timeString;
  if (timeString.length === 3) {
    const hour = timeString.slice(0, 1);
    const minutes = timeString.slice(1);

    if (hour <= 9 && hour >= 1) {
      formattedTimeString = "0" + hour + minutes;
    }
  }
  const before = formattedTimeString + timePeriod;

  const dayjsObj = dayjs(before, ["hhmma", "ha"]);

  console.log(dayjs(dayjsObj).format());
  return dayjs(dayjsObj).format();
};
