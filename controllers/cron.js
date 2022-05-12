import { CronJob } from "cron";
import dayjs from "dayjs";
import { updateAdmins, updateUsers } from "../botlogic/broadcast.js";
import { getTimeAndSalesCSV, uploadTimeAndSalesCSV } from "./timeAndSales.js";
import { settings as local_settings } from "../settings.js";
import { fetch_settings, toggle_auto_upload } from "./settings.js";
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

    if (local_settings.update_users) updateUsers("time_and_sales", spiel);
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

export const get_job_status = async () => {
  console.log("in get_job_status: ");
  console.log("intraday.running: ", intraday.running);
  console.log("end_of_session.running: ", end_of_session.running);

  const mongo_settings = await fetch_mongo_settings();

  console.log("mongo_settings: ", mongo_settings);

  updateAdmins(`MongoDB auto_upload: ${mongo_settings.auto_upload}`);

  if (intraday.running) updateAdmins("intraday running");
  if (end_of_session.running) updateAdmins("end_of_session running");

  const running = intraday.running && end_of_session.running;
  return running ? running : false;
};

export const toggle_job = async (on, initial_run) => {
  console.log("in toggle_job: ", on);
  console.log("initial_run: ", initial_run);
  const running = intraday.running && end_of_session.running;

  try {
    if (typeof on !== "boolean") {
      throw new Error(
        "Wrong argument supplied. Must be a Boolean. True for turn on, False for turn off."
      );
    }

    if (running) {
      if (!on) {
        // if running, and "auto upload off"
        intraday.stop();
        end_of_session.stop();
        if (!initial_run) {
          // if its initial run, no need to toggle (would be redundant)
          const updated_settings = await toggle_auto_upload(false);
          updateAdmins(`MongoDB auto_upload: ${updated_settings.auto_upload}`);
        }
        return "job stopped";
      } else {
        return "job already running";
      }
    } else {
      if (on) {
        // if not running, and "auto upload on"
        intraday.start();
        end_of_session.start();
        if (!initial_run) {
          // if its initial run, no need to toggle (would be redundant)
          const updated_settings = await toggle_auto_upload(true);
          updateAdmins(`MongoDB auto_upload: ${updated_settings.auto_upload}`);
        }
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

const update_local_cron_settings = async () => {
  // pull settings from MongoDB
  const mongo_settings = await fetch_settings();

  if (local_settings.testing) {
    console.log("in testing environment. Avoiding running cron.");
    return;
  }

  toggle_job(mongo_settings.auto_upload, true);
};

// run it on initialization
update_local_cron_settings();
