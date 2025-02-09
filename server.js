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
  timestamp: { type: Date, default: Date.now },
});

const Reading = mongoose.model("Reading", ReadingSchema);

const updateTimestamps = async () => {
  const readings = await Reading.find();
  for (const reading of readings) {
    if (typeof reading.timestamp === "string") {
      reading.timestamp = new Date(reading.timestamp); // Convert string to Date
      await reading.save();
    }
  }
  console.log("Timestamps updated!");
};

updateTimestamps();


app.post("/add-reading", async (req, res) => {
  const newReading = new Reading({
    meterId: req.body.meterId,
    reading: req.body.reading,
    timestamp: new Date(), // Store as Date
  });

  await newReading.save();
  res.send("Reading saved!");
});


app.get("/get-readings/:meterId", async (req, res) => {
  const meterReadings = await Reading.find({ meterId: req.params.meterId }).sort({ timestamp: 1 });
  res.json(meterReadings);
});

// API to fetch total usage per meter
app.get("/total-usage/:meterId", async (req, res) => {
  const totalUsage = await Reading.aggregate([
    { $match: { meterId: req.params.meterId } },
    { $group: { _id: "$meterId", total: { $sum: "$reading" } } },
  ]);
  res.json(totalUsage.length ? totalUsage[0] : { _id: req.params.meterId, total: 0 });
});

// API to fetch daily usage per meter
app.get("/daily-usage/:meterId", async (req, res) => {
  const dailyUsage = await Reading.aggregate([
    { $match: { meterId: req.params.meterId } },
    { $group: {
        _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } },
        total: { $sum: "$reading" },
      } 
    },
    { $sort: { "_id.date": 1 } }
  ]);
  res.json(dailyUsage);
});

// API to fetch monthly usage per meter
app.get("/monthly-usage/:meterId", async (req, res) => {
  const monthlyUsage = await Reading.aggregate([
    { $match: { meterId: req.params.meterId } },
    { $group: {
        _id: { month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } } },
        total: { $sum: "$reading" },
      }
    },
    { $sort: { "_id.month": 1 } }
  ]);
  res.json(monthlyUsage);
});

app.delete("/clear-readings", async (req, res) => {
  await Reading.deleteMany({});
  res.send("All readings cleared!");
});

app.listen(5000, () => console.log("Server running on port 5000"));
