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

export const time_and_sales = new CronJob(
  "30 */10 9-12,14-16 * * 1-5",
  async function () {
    console.log("in time_and_sales job onTick function");
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
  }
);

const job = time_and_sales;

export const get_job_status = () => {
  console.log("in get_job_status");
  console.log("job.running: ", job.running);
  return job.running ? job.running : false;
};

export const toggle_job = (turn_on) => {
  console.log("in toggle_job: ", turn_on);
  console.log("job.running: ", job.running);
  try {
    if (typeof turn_on !== "boolean") {
      throw new Error(
        "Wrong argument supplied. Must be a Boolean. True for turn on, False for turn off."
      );
    }

    if (job.running) {
      if (!turn_on) {
        job.stop();
        return "job stopped";
      } else {
        return "job already running";
      }
    } else {
      if (turn_on) {
        job.start();
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
