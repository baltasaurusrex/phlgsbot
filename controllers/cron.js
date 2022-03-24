import { CronJob } from "cron";
import dayjs from "dayjs";

export const test_job = new CronJob(
  "*/15 * * * * *",
  function () {
    console.log("time: ", dayjs().format(`MM/DD/YY hh:mm:ss`));
  },
  "Asia/Manila"
);

export const job_status = () => {
  return test_job.running;
};

export const toggle_job = () => {
  try {
    if (test_job.running) {
      test_job.stop();
      return "job stopped";
    } else {
      test_job.start();
      return "job started";
    }
  } catch (err) {
    return err.message;
  }
};

// console.log("job: ", job);
// job.start();
// job2.start();
// job.stop();
