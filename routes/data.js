import express from "express";

const router = express.Router();

router.get("/histogram", async (req, res) => {
  try {
    res.status(200).send("/histogram hit");
  } catch (err) {
    res.status(400).send("error");
  }
});
