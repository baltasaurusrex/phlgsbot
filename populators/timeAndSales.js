import xlsx from "xlsx";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import {
  getValidIsins,
  getSeriesWithIsin,
  getSeries,
} from "../controllers/isins.js";
import { createDealtUpdate, deleteLastDealts } from "../controllers/updates.js";
import Update from "../models/Update.js";

import { getBBAId } from "../utils/admin.js";

export const uploadTimeAndSales = async (filename) => {
  try {
    const validIsins = await getValidIsins();
    console.log("validIsins: ", validIsins);
    // get the date from the filename
    if (!/^(\d{2})-(\d{2})-(\d{4})$/.test(filename))
      throw "Incorrectly formatted filename";

    const [full, month, day, year] = filename.match(
      /^(\d{2})-(\d{2})-(\d{4})$/
    );

    const date = dayjs(filename, "MM-DD-YYYY").toDate();
    console.log("date: ", date);

    const deletedLastDealts = await deleteLastDealts(date);
    console.log("deletedLastDealts: ", deletedLastDealts);

    const workbook = xlsx.readFile(`timeAndSalesData/${filename}.csv`);
    const worksheet = workbook.Sheets["Sheet1"];
    const parsed = xlsx.utils.sheet_to_json(worksheet);

    const BBAId = await getBBAId();

    const deals = (
      await Promise.all(
        parsed.map(async (deal) => {
          if (!validIsins.includes(deal.isin)) return null;

          let time = dayjs(deal.time, "h:mm:ss A")
            .set("month", month - 1) //gotta be zero indexed
            .set("date", day)
            .set("year", year)
            .format();

          const series = await getSeriesWithIsin(deal.isin);

          const { yield: price, vol: volume } = deal;
          return {
            series,
            type: "last_dealt",
            action: "mapped",
            price,
            volume,
            broker: "MOSB",
            creator: BBAId,
            time,
          };
        })
      )
    ).filter((deal) => deal !== null);

    const attempts = await Promise.allSettled(
      deals.slice().map(async (deal) => {
        const possibleDuplicateDeal = await Update.findOne({
          series: deal.series,
          type: deal.type,
          lastDealt: deal.price,
          lastDealtVol: deal.volume,
          time: deal.time,
        });

        if (possibleDuplicateDeal) {
          return Promise.reject({
            message: "Possible duplicate deal",
            deal_uploaded: deal,
            possible_duplicate: possibleDuplicateDeal,
          });
        } else {
          const newDeal = await createDealtUpdate({ ...deal });
          return newDeal;
        }
      })
    );

    const createdDeals = attempts.filter((deal) => deal.status === "fulfilled");
    const rejectedDeals = attempts.filter((deal) => deal.status === "rejected");

    console.log("createdDeals: ", createdDeals);
    console.log("rejectedDeals: ", rejectedDeals);
    console.log("createdDeals length: ", createdDeals.length);
    console.log("rejectedDeals length: ", rejectedDeals.length);
  } catch (err) {
    return err;
  }
};
