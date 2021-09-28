import Isin from "../models/Isin.js";

export const createIsin = async (data) => {
  console.log("data: ", data);
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
          aliases: [data.series_short, data.series_mosb],
          isin: data.isin,
          maturity: data.maturity,
        },
        { new: true }
      );
    } else {
      //if not, create a new one
      const newIsin = new Isin({
        series: data.series_mosb,
        aliases: [data.series_short, data.series_mosb],
        isin: data.isin,
        maturity: data.maturity,
      });

      savedIsin = await newIsin.save();
    }

    return savedIsin;
  } catch (err) {
    console.log("createIsin err: ", err);
    return Promise.reject(err);
  }
};

export const getValidIsins = async () => {
  try {
    const allIsins = await Isin.find({ aliases: { $exists: true } });

    let allAliases = [];

    allIsins.forEach((isin) => allAliases.push(...isin.aliases));

    return allAliases;
  } catch (err) {
    return err;
  }
};

export const getSeries = async (alias) => {
  try {
    const isin = await Isin.findOne({
      aliases: { $regex: `${alias}`, $options: "gi" },
    }).exec();
    console.log("isin: ", isin);
    return isin?.series;
  } catch (err) {
    return err;
  }
};
