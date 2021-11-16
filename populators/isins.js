import xlsx from "xlsx";
import { createIsin } from "../controllers/isins.js";

function ExcelDateToJSDate(serial) {
  var utc_days = Math.floor(serial - 25569);
  var utc_value = utc_days * 86400;
  var date_info = new Date(utc_value * 1000);

  var fractional_day = serial - Math.floor(serial) + 0.0000001;

  var total_seconds = Math.floor(86400 * fractional_day);

  var seconds = total_seconds % 60;

  total_seconds -= seconds;

  var hours = Math.floor(total_seconds / (60 * 60));
  var minutes = Math.floor(total_seconds / 60) % 60;

  return new Date(
    date_info.getFullYear(),
    date_info.getMonth(),
    date_info.getDate(),
    hours,
    minutes,
    seconds
  );
}

export const populateIsins = async () => {
  const workbook = xlsx.readFile("isinData/isinData.xlsx");
  // console.log("workbook: ", workbook);
  const worksheet = workbook.Sheets["Sheet1"];

  const parsed = xlsx.utils.sheet_to_json(worksheet);
  console.log("parsed: ", parsed);

  const results = await Promise.allSettled(
    parsed.map(async (data) => {
      data.maturity = ExcelDateToJSDate(data.maturity);
      return await createIsin(data);
    })
  );

  let fulfilled = results.filter((el) => el.status === "fulfilled");
  fulfilled = fulfilled.map((obj) => obj.value.keyword);
  let rejected = results.filter((el) => el.status === "rejected");
  rejected = rejected.map((err) => err.reason.keyValue.keyword);

  return { fulfilled, rejected };
};
