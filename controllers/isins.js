import Isin from "../models/Isin.js";
import dayjs from "dayjs";
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);
import { getArbitraryDatesRegex } from "../utils/regex.js";

export const createIsin = async (data) => {
  console.log("in createIsin");
  console.log("data: ", data);
  const aliases = [data.series_mosb];
  if (data.series_short) aliases.push(data.series_short);
  try {
    // check if exists
    let existing = await Isin.findOne({ series: data.series_mosb });
    let savedIsin = {};
    if (existing) {
      // if it exists already, then issue an update
      savedIsin = await Isin.findByIdAndUpdate(
        existing._id,
        {
          series: data.series_mosb,
          aliases,
          isin: data.isin,
          maturity: data.maturity,
          watchlist: data.watchlist,
        },
        { new: true }
      );
    } else {
      //if not, create a new one
      const newIsin = new Isin({
        series: data.series_mosb,
        aliases,
        isin: data.isin,
        maturity: data.maturity,
        watchlist: data.watchlist,
      });

      savedIsin = await newIsin.save();
    }

    return savedIsin;
  } catch (err) {
    return Promise.reject(err);
  }
};

export const getAllIsins = async (options) => {
  try {
    console.log("in getAllIsins: ");

    let mongoQuery = {};
    if (options) {
      if (options.watchlist_only === true) mongoQuery.watchlist = true;
    }

    const all = await Isin.find(mongoQuery);

    let sorted = all.sort((a, b) => a.maturity - b.maturity);

    return sorted;
  } catch (err) {
    return err;
  }
};

export const getValidSeries = async () => {
  try {
    const allIsins = await Isin.find({ aliases: { $exists: true } });

    let allAliases = [];

    allIsins.forEach((isin) => allAliases.push(...isin.aliases));

    return allAliases;
  } catch (err) {
    return err;
  }
};

export const getValidIsins = async () => {
  try {
    const all = await Isin.find({});

    let validIsins = [];

    all.forEach(({ isin }) => validIsins.push(isin));

    return validIsins;
  } catch (err) {
    return err;
  }
};

export const getSeries = async (alias) => {
  try {
    if (!alias) return null;

    const instrument = await Isin.findOne({
      aliases: { $regex: `${alias}`, $options: "gi" },
    }).exec();
    return instrument?.series;
  } catch (err) {
    return err;
  }
};

export const getSeriesWithIsin = async (isin) => {
  try {
    const instrument = await Isin.findOne({
      isin: { $regex: `${isin}`, $options: "gi" },
    }).exec();
    return instrument?.series;
  } catch (err) {
    return err;
  }
};

export const getTenor = async (series, date_input) => {
  // date_input, if blank, = today
  // otherwise, this is the period your getting the YTM for
  // date_input should be formatted either ["MM"]
  try {
    if (!series) throw new Error("Series must be supplied.");

    const date_regex = getArbitraryDatesRegex();

    let date = null;

    if (!date_input) {
      date = dayjs().format("MM/DD/YYYY");
    } else if (date_regex.test(date_input)) {
      date = date_input;
    } else {
      throw new Error(
        "Incorrectly formatted date. Please use MM/DD or MM/DD/YY or MM/DD/YYYY."
      );
    }

    const from_period = dayjs(date, [
      "MM/DD",
      "MM/DD/YY",
      "MM/DD/YYYY",
    ]).toDate();

    const instrument = await Isin.findOne({
      series,
    });

    if (!instrument)
      throw new Error("No instrument matches the series supplied.");

    const mat_date = dayjs(instrument.maturity);
    const today = dayjs(date).format("YYYY-MM-DD");
    let diff = mat_date.diff(today, "year", true);
    diff = parseFloat(diff.toFixed(2));

    if (diff < 0) throw new Error("Already matured.");

    return diff;
  } catch (err) {
    return err;
  }
};
