import { CronJob } from "cron";
import dayjs from "dayjs";
import { updateAdmins, updateUsers } from "../botlogic/broadcast.js";
import { getTimeAndSalesCSV, uploadTimeAndSalesCSV } from "./timeAndSales.js";
import { settings } from "../settings.js";
import axios from "axios";

export const test = new CronJob("*/15 * * * * *", async function () {
  console.log("in test CronJob");
  try {
    const timestamp = `${dayjs().format(`MM/DD/YY hh:mm:ss`)}`;
    updateAdmins(`Auto-uploading time and sales as of ${timestamp}`);
    const res = await axios.get(
      `https://random-word-api.herokuapp.com/word?number=10`
    );
    console.log("res.data: ", res.data);
  } catch (err) {
    console.log("err: ", err);
  }
});

const upload_function = async function () {
  console.log("in end_of_session job onTick function");
  // console.log("time: ", dayjs().format(`MM/DD/YY hh:mm:ss`));
  const timestamp = `${dayjs().format(`MM/DD/YY hh:mm:ss`)}`;
  updateAdmins(`Auto-uploading time and sales as of ${timestamp}`);
  try {
    const res = await getTimeAndSalesCSV();
    if (!res.trades_with_series) {
      // if an error is returned
      updateAdmins(res);
      return;
    }

    if (res.trades_with_series.length < 1) {
      // if  there are no trades
      updateAdmins(res.message);
      return;
    }

    if (res.invalidIsins.length > 0) {
      // if there's an invalid isin, notify the admin
      updateAdmins(`Invalid isins: ${res.invalidIsins.join(", ")}`);
    } // but then continue to upload the rest

    const { spiel, uploaded_trades } = await uploadTimeAndSalesCSV(
      res.trades_with_series
    );

    updateAdmins(spiel);

    if (settings.update_users) updateUsers("time_and_sales", spiel);
    return;
  } catch (err) {
    console.log("error in time_and_sales job: ", err);
  }
};

const test_function = async function () {
  console.log("in test CronJob: ");
  try {
    const timestamp = `${dayjs().format(`MM/DD/YY hh:mm:ss`)}`;
    updateAdmins(`Auto-uploading time and sales as of ${timestamp}`);
    // const res = await axios.get(
    //   `https://random-word-api.herokuapp.com/word?number=10`
    // );
    // console.log("res.data: ", res.data);
  } catch (err) {
    console.log("err: ", err);
  }
};

export const intraday = new CronJob(
  "15 */10 9-11,14-15 * * 1-5",
  upload_function
);

export const end_of_session = new CronJob(
  "15 0 12,16 * * 1-5",
  upload_function
);

export const get_job_status = () => {
  console.log("in get_job_status: ");
  console.log("intraday.running: ", intraday.running);
  console.log("end_of_session.running: ", end_of_session.running);

  if (intraday.running) updateAdmins("intraday running");
  if (end_of_session.running) updateAdmins("end_of_session running");

  const running = intraday.running && end_of_session.running;
  return running ? running : false;
};

export const toggle_job = (turn_on) => {
  console.log("in toggle_job: ", turn_on);
  const running = intraday.running && end_of_session.running;

  try {
    if (typeof turn_on !== "boolean") {
      throw new Error(
        "Wrong argument supplied. Must be a Boolean. True for turn on, False for turn off."
      );
    }

    if (running) {
      if (!turn_on) {
        intraday.stop();
        end_of_session.stop();
        return "job stopped";
      } else {
        return "job already running";
      }
    } else {
      if (turn_on) {
        intraday.start();
        end_of_session.start();
        return "job started";
      } else {
        return "no job running";
      }
    }
  } catch (err) {
    console.log("err: ", err);
    return err.message;
  }
};

// console.log("job: ", job);
// job.start();
// job2.start();
// job.stop();
