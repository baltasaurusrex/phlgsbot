import express from "express";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);

import {
  getSecurityList,
  getHistogram,
  getOHLC,
} from "../controllers/chartingData.js";

const router = express.Router();

router.get("/securityList", getSecurityList);

router.get("/ohlc", getOHLC);

router.get("/histogram", getHistogram);

export default router;
