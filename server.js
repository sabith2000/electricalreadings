const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb+srv://zeusolympusgreekgod:uB18zOP6Nm6paWbH@electricalreadingsclust.nrix7.mongodb.net/?retryWrites=true&w=majority&appName=electricalreadingscluster", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB Atlas"))
.catch(err => console.error("MongoDB connection error:", err));

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
