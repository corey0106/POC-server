const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const authRoutes = require("./routes/auth");
const { getZoningFitScore } = require("./engine/zoning");
const { getHighwayDistance, getHighwayDistanceScore } = require("./engine/highway");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use("/api/auth", authRoutes);

const getOwnerType = (owner) => {
  if (!owner) return "Unknown";
  const entityKeywords = ["LLC", "INC", "CORP", "CO", "TRUST"];
  return entityKeywords.some(kw => owner.toUpperCase().includes(kw)) ? "Entity" : "Individual";
};

const getYearsOwned = (dateSold) => {
  if (!dateSold) return null;
  const yearSold = new Date(dateSold).getFullYear();
  const currentYear = new Date().getFullYear();
  return isNaN(yearSold) ? null : currentYear - yearSold;
};

const getInvestmentScore = (parcel) => {
  let score = 0;
  if (parcel.acreage > 1 && parcel.acreage < 5) score += 1;
  if (parcel.zoningFitScore >= 4) score += 2;
  if (parcel.ownerType === "Entity") score += 1;
  if ((parcel.yearsOwned ?? 0) > 10) score += 1;
  if (parcel.highwayDistanceScore >= 7) score += 1;
  return score;
};

app.get("/api/parcels/:county", (req, res) => {
  const { county } = req.params;
  
  // Try multiple possible CSV file paths
  const possibleCsvPaths = [
    path.join(__dirname, "data", `${county}_parcels.csv`),
    path.join(__dirname, "data", `${county.toLowerCase()}_parcels.csv`),
    path.join(__dirname, "data", `${county.toUpperCase()}_parcels.csv`),
    path.join(process.cwd(), "data", `${county}_parcels.csv`),
    path.join(process.cwd(), "server", "data", `${county}_parcels.csv`)
  ];
  
  let filePath = null;
  for (const testPath of possibleCsvPaths) {
    if (fs.existsSync(testPath)) {
      filePath = testPath;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({ error: "CSV file not found" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");

  const stream = fs.createReadStream(filePath).pipe(csv());

  stream.on("data", (row) => {
    const ownerName = row["owner"] || "Unknown";

    const mailingAddress = [
      row["mailadd"],
      row["mail_addpref"],
      row["mail_addstr"],
      row["mail_addsttyp"],
      row["mail_addstsuf"],
      row["mail_unit"] ? `Unit ${row["mail_unit"]}` : null,
      row["mail_city"],
      row["mail_state2"],
      row["mail_zip"]
    ].filter(Boolean).join(" ");

    const parcel = {
      parcelId: row["parcelnumb"] || "Unknown",
      owner: ownerName,
      address: mailingAddress || "N/A",
      acreage: parseFloat(row["ll_gisacre"]) || 0,
      zoning: row["zoning"] || "Unknown",
      zoning_desc: row["zoning_description"] || "Unknown",
      zoningFitScore: getZoningFitScore(row["zoning"]),
      gps: {
        lat: row["lat"] || "Unknown",
        lon: row["lon"] || "Unknown",
      },
      investmentScore: null,
      ownerType: getOwnerType(ownerName),
      yearsOwned: getYearsOwned(row["saledate"]),
      contactInfo: null,
      highwayDistance: null,
      highwayDistanceScore: null
    };

    parcel.investmentScore = getInvestmentScore(parcel);

    res.write(JSON.stringify(parcel) + "\n");
  });

  stream.on("end", () => {
    res.end();
  });

  stream.on("error", (err) => {
    console.error("Stream error:", err);
    res.status(500).end();
  });
});

app.post("/api/parcels/:county/highway-distances", (req, res) => {
  const { county } = req.params;
  const { parcels } = req.body;

  if (!parcels || !Array.isArray(parcels)) {
    return res.status(400).json({ error: "Parcels array is required" });
  }

  try {
    const parcelsWithHighwayData = parcels.map(parcel => {
      try {
        if (parcel.gps && parcel.gps.lat !== "Unknown" && parcel.gps.lon !== "Unknown") {
          const highwayInfo = getHighwayDistance(parcel.gps.lat, parcel.gps.lon, county);
          const highwayDistanceScore = highwayInfo ? getHighwayDistanceScore(highwayInfo.distanceMiles) : null;

          return {
            ...parcel,
            highwayDistance: highwayInfo ? {
              distanceMiles: highwayInfo.distanceMiles,
              distanceKm: highwayInfo.distanceKm,
              roadName: highwayInfo.roadName,
              roadType: highwayInfo.roadType
            } : null,
            highwayDistanceScore: highwayDistanceScore
          };
        }
        return parcel;
      } catch (error) {
        return {
          ...parcel,
          highwayDistance: null,
          highwayDistanceScore: null
        };
      }
    });

    res.json({ parcels: parcelsWithHighwayData });
  } catch (error) {
    console.error('Error in highway distance calculation:', error);
    res.status(500).json({ error: "Internal server error during highway distance calculation" });
  }
});

// Health check endpoint for deployment monitoring
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
