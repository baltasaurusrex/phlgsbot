import express from "express";
import dayjs from "dayjs";
import CustomParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(CustomParseFormat);
import RelativeTime from "dayjs/plugin/relativeTime.js";
dayjs.extend(RelativeTime);

import {
  getSecurityList,
  getHistogramData,
} from "../controllers/chartingData.js";

const router = express.Router();

router.get("/securityList", getSecurityList);

router.get("/histogram", getHistogramData);

export default router;
