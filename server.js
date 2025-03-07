const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();

app.set("trust proxy", 1);

app.use(cors({ origin: "https://electrical-readings.netlify.app" }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500
}));

mongoose.connect("mongodb+srv://zeusolympusgreekgod:uB18zOP6Nm6paWbH@electricalreadingsclust.nrix7.mongodb.net/?retryWrites=true&w=majority&appName=electricalreadingscluster", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const ReadingSchema = new mongoose.Schema({
  meterId: { type: String, required: true, trim: true },
  reading: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, default: Date.now },
});

const Reading = mongoose.model("Reading", ReadingSchema);

const fixReadingTypes = async () => {
  try {
    const readings = await Reading.find();
    for (const reading of readings) {
      if (typeof reading.reading === "string") {
        reading.reading = parseFloat(reading.reading);
        await reading.save();
      }
    }
    console.log("Reading values updated to numbers!");
  } catch (error) {
    console.error("Error fixing reading types:", error);
  }
};
fixReadingTypes();

const fixTimestamps = async () => {
  try {
    const readings = await Reading.find();
    for (const reading of readings) {
      if (typeof reading.timestamp === "string") {
        reading.timestamp = new Date(reading.timestamp);
        await reading.save();
      }
    }
    console.log("Timestamps updated to Date objects!");
  } catch (error) {
    console.error("Error fixing timestamps:", error);
  }
};
fixTimestamps();

const formatDate = (date, format = "DD/MM/YYYY HH:mm:ss") => {
  const options = {
    "DD/MM/YYYY HH:mm:ss": { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true },
    "MM/DD/YYYY HH:mm:ss": { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }
  };
  return new Date(date).toLocaleString("en-IN", options[format] || options["DD/MM/YYYY HH:mm:ss"]);
};

// Add Reading with Validation
app.post("/add-reading", async (req, res) => {
  try {
    const { meterId, reading } = req.body;
    if (!meterId || typeof reading !== "number" || reading < 0) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    // Check last reading for this meter
    const lastReading = await Reading.findOne({ meterId }).sort({ timestamp: -1 });
    if (lastReading && reading < lastReading.reading) {
      return res.status(400).json({ error: "New reading cannot be less than the last reading" });
    }

    const istTime = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
    const newReading = new Reading({ meterId, reading, timestamp: istTime });
    await newReading.save();
    res.status(201).json({ message: "Reading saved with IST timestamp!" });
  } catch (error) {
    console.error("Error adding reading:", error);
    res.status(500).json({ error: "Failed to save reading" });
  }
});

app.get("/get-readings/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    if (!meterId) return res.status(400).json({ error: "Meter ID required" });

    const meterReadings = await Reading.find({ meterId }).sort({ timestamp: 1 });
    const formattedReadings = meterReadings.map((reading) => ({
      ...reading._doc,
      timestamp: formatDate(reading.timestamp),
    }));
    res.json(formattedReadings);
  } catch (error) {
    console.error("Error fetching readings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/total-usage/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    if (!meterId) return res.status(400).json({ error: "Meter ID required" });

    const totalUsage = await Reading.aggregate([
      { $match: { meterId } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$meterId",
          firstReading: { $first: "$reading" },
          lastReading: { $last: "$reading" }
        }
      },
      {
        $project: {
          _id: 1,
          totalUsage: { $subtract: ["$lastReading", "$firstReading"] }
        }
      }
    ]);
    res.json(totalUsage.length ? totalUsage[0] : { _id: meterId, totalUsage: 0 });
  } catch (error) {
    console.error("Error calculating total usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/daily-usage/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    if (!meterId) return res.status(400).json({ error: "Meter ID required" });

    const readings = await Reading.find({ meterId }).sort({ timestamp: 1 });
    if (!readings.length) return res.json([]);

    const dailyUsage = [];
    let previousReading = null;

    for (const reading of readings) {
      const date = reading.timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
      const currentDay = dailyUsage.find(d => d.date === date);

      if (!currentDay) {
        // First reading of the day
        const usage = previousReading === null ? reading.reading : reading.reading - previousReading.reading;
        dailyUsage.push({
          date,
          formattedDate: formatDate(reading.timestamp, "DD/MM/YYYY"),
          usage: usage < 0 ? 0 : usage // Prevent negative usage
        });
      } else {
        // Update last reading of the day
        currentDay.usage = reading.reading - (previousReading ? previousReading.reading : 0);
      }
      previousReading = reading;
    }

    res.json(dailyUsage);
  } catch (error) {
    console.error("Error calculating daily usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/monthly-usage/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    if (!meterId) return res.status(400).json({ error: "Meter ID required" });

    const dailyUsage = await Reading.aggregate([
      { $match: { meterId } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          firstReading: { $first: "$reading" },
          lastReading: { $last: "$reading" }
        }
      },
      {
        $project: {
          date: "$_id",
          usage: {
            $cond: {
              if: { $eq: ["$firstReading", "$lastReading"] },
              then: "$firstReading", // First day reading if only one
              else: { $subtract: ["$lastReading", "$firstReading"] }
            }
          }
        }
      }
    ]);

    const monthlyUsage = dailyUsage.reduce((acc, curr) => {
      const [year, month] = curr.date.split("-");
      const monthKey = `${year}-${month}`;
      if (!acc[monthKey]) {
        acc[monthKey] = { month: `${monthNames[parseInt(month)]} ${year}`, usage: 0 };
      }
      acc[monthKey].usage += curr.usage >= 0 ? curr.usage : 0; // Sum daily usage
      return acc;
    }, {});

    res.json(Object.values(monthlyUsage));
  } catch (error) {
    console.error("Error calculating monthly usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/custom-range-usage/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    const { startDate, endDate } = req.query;

    if (!meterId || !startDate || !endDate) {
      return res.status(400).json({ error: "Meter ID, startDate, and endDate are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start > end) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    const readings = await Reading.find({
      meterId,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });

    if (!readings.length) {
      return res.json({ totalUsage: 0, dailyUsage: [] });
    }

    const dailyUsage = [];
    let previousReading = null;

    // Get the last reading before the range for accurate first day calculation
    const preRangeReading = await Reading.findOne({
      meterId,
      timestamp: { $lt: start }
    }).sort({ timestamp: -1 });

    for (const reading of readings) {
      const date = reading.timestamp.toISOString().split("T")[0];
      const currentDay = dailyUsage.find(d => d.date === date);

      if (!currentDay) {
        const usage = previousReading === null
          ? (preRangeReading ? reading.reading - preRangeReading.reading : reading.reading)
          : reading.reading - previousReading.reading;
        dailyUsage.push({
          date,
          formattedDate: formatDate(reading.timestamp, "DD/MM/YYYY"),
          usage: usage < 0 ? 0 : usage
        });
      } else {
        currentDay.usage = reading.reading - (previousReading ? previousReading.reading : (preRangeReading ? preRangeReading.reading : 0));
      }
      previousReading = reading;
    }

    const totalUsage = dailyUsage.reduce((sum, day) => sum + day.usage, 0);
    res.json({ totalUsage, dailyUsage });
  } catch (error) {
    console.error("Error calculating custom range usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/clear-readings", async (req, res) => {
  try {
    await Reading.deleteMany({});
    res.json({ message: "All readings cleared!" });
  } catch (error) {
    console.error("Error clearing readings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

app.listen(5000, () => console.log("Server running on port 5000"));