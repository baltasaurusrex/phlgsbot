import axios from "axios";
import { getPDSDateFormat } from "../utils/regex.js";

const instance = axios.create({
  baseURL: "https://marketpage.pds.com.ph/",
});

const default_params = {
  callback: "angular.callbacks._j",
  participant: "all",
  token: "7VpYt1atB86CHE5MPLYU",
};

export const getTimeAndSales = async (trade_date) => {
  try {
    let params_obj = {
      ...default_params,
    };

    let res = null;

    if (trade_date) {
      res = await instance.get("api/gs/historical/GetGovtTimeSales", {
        params: {
          ...params_obj,
        },
      });
    } else {
      res = await instance.get("api/gs/GetGovtTimeSales", {
        params: {
          ...params_obj,
        },
      });
    }

    return res;
  } catch (err) {
    return err;
  }
};

export const getISINData = async () => {
  try {
  } catch (err) {
    return err;
  }
};
