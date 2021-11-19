import Isin from "../models/Isin.js";

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
    console.log("options: ", options);
    let mongoQuery = {};
    if (options) {
      if (options.watchlist_only === true) mongoQuery.watchlist = true;
    }

    console.log("mongoQuery: ", mongoQuery);

    const all = await Isin.find(mongoQuery);

    console.log("all: ", all);

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
