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
  meterId: String,
  reading: { type: Number, required: true }, // ✅ Ensure reading is a Number
  timestamp: { type: Date, default: Date.now },
});



const Reading = mongoose.model("Reading", ReadingSchema);

const fixReadingTypes = async () => {
  const readings = await Reading.find();
  for (const reading of readings) {
    if (typeof reading.reading === "string") {
      reading.reading = parseFloat(reading.reading); // Convert string to number
      await reading.save();
    }
  }
  console.log("Reading values updated to numbers!");
};
fixReadingTypes();


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

const fixTimestamps = async () => {
  const readings = await Reading.find();
  for (const reading of readings) {
    if (typeof reading.timestamp === "string") {
      reading.timestamp = new Date(reading.timestamp); // Convert string to Date
      await reading.save();
    }
  }
  console.log("Timestamps updated to Date objects!");
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
    const now = new Date(); // Get current UTC time

    // ✅ Convert UTC to IST manually (Add 5 hours 30 minutes)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));

    const newReading = new Reading({
      meterId: req.body.meterId,
      reading: req.body.reading,
      timestamp: istTime, // ✅ Store IST timestamp in MongoDB
    });

    await newReading.save();
    res.send("Reading saved with IST timestamp!");
  } catch (error) {
    console.error("Error adding reading:", error);
    res.status(500).json({ error: "Failed to save reading" });
  }
});



app.get("/get-readings/:meterId", async (req, res) => {
  try {
    const meterReadings = await Reading.find({ meterId: req.params.meterId }).sort({ timestamp: 1 });

    // ✅ Apply formatDate function before sending response
    const formattedReadings = meterReadings.map((reading) => ({
      ...reading._doc,
      timestamp: formatDate(reading.timestamp), // ✅ Format as "DD/MM/YYYY HH:mm:ss"
    }));

    res.json(formattedReadings);
  } catch (error) {
    console.error("Error fetching readings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// API to fetch total usage per meter
app.get("/total-usage/:meterId", async (req, res) => {
  try {
    const totalUsage = await Reading.aggregate([
      { $match: { meterId: req.params.meterId } }, // ✅ Match readings for the meter
      { $sort: { timestamp: 1 } }, // ✅ Ensure first & last readings are correct
      {
        $group: {
          _id: "$meterId",
          firstReading: { $first: "$reading" }, // ✅ First reading recorded for the meter
          lastReading: { $last: "$reading" } // ✅ Last reading recorded for the meter
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
              then: 0, // ✅ If only one reading exists, set to 0
              else: { $subtract: ["$lastReading", "$firstReading"] } // ✅ Last - First
            }
          }
        }
      }
    ]);

    res.json(totalUsage.length ? totalUsage[0] : { _id: req.params.meterId, totalUsage: 0 });
  } catch (error) {
    console.error("Error calculating total usage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// API to fetch daily usage per meter
app.get("/daily-usage/:meterId", async (req, res) => {
  try {
    const dailyUsage = await Reading.aggregate([
      { $match: { meterId: req.params.meterId } },
      { $sort: { timestamp: 1 } }, // ✅ Ensure correct first & last readings
      { $group: {
          _id: { 
            date: { $dateToString: { format: "%d/%m/%Y", date: "$timestamp" } } // ✅ Format as DD/MM/YYYY
          },
          firstReading: { $first: "$reading" },
          lastReading: { $last: "$reading" }
        }
      },
      { $project: {
          _id: 1,
          firstReading: 1,
          lastReading: 1,
          formattedDate: "$_id.date", // ✅ Ensure date is included
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




// API to fetch monthly usage per meter
app.get("/monthly-usage/:meterId", async (req, res) => {
  try {
    const monthlyUsage = await Reading.aggregate([
      { $match: { meterId: req.params.meterId } },
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

    // ✅ Convert month number to month name
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
  await Reading.deleteMany({});
  res.send("All readings cleared!");
});

app.listen(5000, () => console.log("Server running on port 5000"));
