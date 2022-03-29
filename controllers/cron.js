import { CronJob } from "cron";
import dayjs from "dayjs";
import { updateAdmins } from "../botlogic/broadcast.js";
import { getTimeAndSalesCSV } from "./timeAndSales.js";
import { settings } from "../settings.js";

export const test = new CronJob("*/15 * * * * *", async function () {
  console.log("in test CronJob");
  try {
    console.log("time: ", dayjs().format(`MM/DD/YY hh:mm:ss`));
    const words = await fetch(
      `https://random-word-api.herokuapp.com/word?number=10`
    );
    console.log("words: ", words);
  } catch (err) {
    console.log("err: ", err);
  }
});

export const timeAndSales_job = new CronJob(
  "30 */1 9-12,14-16 * * 1-5",
  async function () {
    console.log("in timeAndSales_job onTick function");
    // console.log("time: ", dayjs().format(`MM/DD/YY hh:mm:ss`));
    const timestamp = `time: ${dayjs().format(`MM/DD/YY hh:mm:ss`)}`;
    try {
      const res = await getTimeAndSalesCSV(date);
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
      console.log("error in timeAndSales_job: ", err);
    }
  }
);

const job = test;

export const get_job_status = () => {
  console.log("in get_job_status");
  console.log("job.running: ", job.running);
  return job.running ? job.running : false;
};

export const toggle_job = () => {
  console.log("in toggle_job");
  console.log("job.running: ", job.running);
  try {
    if (job.running) {
      job.stop();
      return "job stopped";
    } else {
      job.start();
      return "job started";
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
