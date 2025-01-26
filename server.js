const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/electrical_readings", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const ReadingSchema = new mongoose.Schema({
  meterId: String, // ID for each meter
  reading: String,
  timestamp: String,
});

const Reading = mongoose.model("Reading", ReadingSchema);

app.post("/add-reading", async (req, res) => {
  const newReading = new Reading(req.body);
  await newReading.save();
  res.send("Reading saved!");
});

app.get("/get-readings/:meterId", async (req, res) => {
  const meterReadings = await Reading.find({ meterId: req.params.meterId });
  res.json(meterReadings);
});

app.listen(5000, () => console.log("Server running on port 5000"));
