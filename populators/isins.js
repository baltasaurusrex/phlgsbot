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
  try {
    const workbook = xlsx.readFile("isinData/isinData.xlsx");
    // console.log("workbook: ", workbook);
    const worksheet = workbook.Sheets["List"];

    const parsed = xlsx.utils.sheet_to_json(worksheet);

    const results = await Promise.allSettled(
      parsed.map(async (data, index) => {
        data.maturity_date = ExcelDateToJSDate(data.maturity_date);
        data.issue_date = ExcelDateToJSDate(data.issue_date);
        return await createIsin(data);
      })
    );

    let fulfilled = results.filter((obj) => obj.status === "fulfilled");
    fulfilled = fulfilled.map((obj) => obj.value);
    let rejected = results.filter((obj) => obj.status === "rejected");
    rejected = rejected.map((err) => err.reason.keyValue);
    console.log("rejected: ", rejected);

    return { fulfilled, rejected };
  } catch (err) {
    return err;
  }
};
