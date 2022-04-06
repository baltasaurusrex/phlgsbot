import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);

export const getHistogramData = async (req, res) => {
  try {
    // query should be: {series, period_start, period_end}
    const { query } = req;
    console.log("query: ", query);
    console.log("query.series: ", query.series);
    console.log("query.period_start: ", query.period_start);
    console.log("query.period_end: ", query.period_end);

    // check for errors
    let errors = [];
    if (query.series == null) errors.push("No series inputted.");
    if (query.period_start == null) errors.push("No period start.");
    if (query.period_end == null) errors.push("No period end.");
    if (errors.length > 0) throw new Error(errors);

    // get the time and sales data of that isin for that period
    // const mosb_data = await fetchTimeAndSales()
    // turn that data into a histogram form

    res.status(200).send("/histogram hit");
  } catch (err) {
    res.status(400).send(err.message);
  }
};