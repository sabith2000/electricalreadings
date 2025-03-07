const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(cors({ origin: "https://electrical-readings.netlify.app" }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
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

app.post("/add-reading", async (req, res) => {
  try {
    const { meterId, reading } = req.body;
    if (!meterId || typeof reading !== "number" || reading < 0) {
      return res.status(400).json({ error: "Invalid input data" });
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
          firstReading: 1,
          lastReading: 1,
          totalUsage: {
            $cond: {
              if: { $eq: ["$firstReading", "$lastReading"] },
              then: 0,
              else: { $subtract: ["$lastReading", "$firstReading"] }
            }
          }
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

    const dailyUsage = await Reading.aggregate([
      { $match: { meterId } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: { date: { $dateToString: { format: "%d/%m/%Y", date: "$timestamp" } } },
          firstReading: { $first: "$reading" },
          lastReading: { $last: "$reading" }
        }
      },
      {
        $project: {
          _id: 1,
          firstReading: 1,
          lastReading: 1,
          formattedDate: "$_id.date",
          usage: {
            $cond: {
              if: { $eq: ["$firstReading", "$lastReading"] },
              then: 0,
              else: { $subtract: ["$lastReading", "$firstReading"] }
            }
          }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]);
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

    const monthlyUsage = await Reading.aggregate([
      { $match: { meterId } },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } } },
          firstReading: { $first: "$reading" },
          lastReading: { $last: "$reading" }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]);

    const monthNames = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const formattedMonthlyUsage = monthlyUsage.map(entry => ({
      month: `${monthNames[parseInt(entry._id.month.split("-")[1])]} ${entry._id.month.split("-")[0]}`,
      usage: entry.lastReading - entry.firstReading
    }));
    res.json(formattedMonthlyUsage);
  } catch (error) {
    console.error("Error calculating monthly usage:", error);
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

app.listen(5000, () => console.log("Server running on port 5000"));