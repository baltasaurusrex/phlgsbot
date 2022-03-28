import { CronJob } from "cron";
import dayjs from "dayjs";

export const test_job = new CronJob("0 */1 * * * *", function () {
  console.log("time: ", dayjs().format(`MM/DD/YY hh:mm:ss`));
});

export const get_job_status = () => {
  console.log("in get_job_status");
  console.log("test_job.running: ", test_job.running);
  return test_job.running ? test_job.running : false;
};

export const toggle_job = () => {
  console.log("in toggle_job");
  console.log("test_job.running: ", test_job.running);
  try {
    if (test_job.running) {
      test_job.stop();
      return "job stopped";
    } else {
      test_job.start();
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
