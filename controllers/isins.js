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
    let existing = await Isin.findOne({
      $or: [{ series: data.series_mosb }, { isin: data.isin }],
    });
    let savedIsin = {};

    let update_obj = {
      series: data.series_mosb,
      aliases,
      isin: data.isin,
      coupon_rate: isNaN(data.coupon_rate) ? null : data.coupon_rate,
      issue_date: data.issue_date,
      maturity_date: data.maturity_date,
    };

    if (data.watchlist) update_obj.watchlist = data.watchlist;

    if (existing) {
      // if it exists already, then issue an update
      savedIsin = await Isin.findByIdAndUpdate(
        existing._id,
        {
          ...update_obj,
        },
        { new: true }
      );
    } else {
      //if not, create a new one
      const newIsin = new Isin({
        ...update_obj,
      });

      savedIsin = await newIsin.save();

      console.log("new isin created: ", savedIsin);
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

    let sorted = all.sort((a, b) => a.maturity_date - b.maturity_date);

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

    const mat_date = dayjs(instrument.maturity_date);
    const today = dayjs(date).format("YYYY-MM-DD");
    let diff = mat_date.diff(today, "year", true);
    diff = parseFloat(diff.toFixed(2));

    if (diff < 0) throw new Error("Already matured.");

    return diff;
  } catch (err) {
    return err;
  }
};

export const getComparable = async (identifier_input, years_input) => {
  // if no years input, just assume it's a step down
  try {
    if (!identifier_input) throw new Error("No identifier given.");
    const yrs_diff = years_input ? years_input : -1;

    const security = await Isin.findOne({
      $or: [
        { series: identifier_input },
        { aliases: identifier_input },
        { isin: identifier_input },
      ],
    });

    if (!security)
      throw new Error(
        `No matching security for given identifier: ${identifer_input}`
      );

    return security;
  } catch (err) {
    return err;
  }
};
