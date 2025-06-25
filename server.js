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
  const filePath = path.join(__dirname, "data", `${county}_parcels.csv`);

  if (!fs.existsSync(filePath)) {
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

  console.log(`🛣️ Calculating highway distances for ${parcels.length} parcels...`);

  try {
    // First, check if highway data is available
    const filePath = path.join(__dirname, "data", `roaddata_${county}.geojson`);
    const fileExists = fs.existsSync(filePath);
    
    if (!fileExists) {
      console.warn(`⚠️ Highway data file not found: ${filePath}`);
      console.log(`📋 Returning parcels without highway data due to missing file`);
      
      // Return parcels with null highway data and a warning
      const parcelsWithoutHighway = parcels.map(parcel => ({
        ...parcel,
        highwayDistance: null,
        highwayDistanceScore: null,
        _highwayWarning: "Highway data file not available on server"
      }));
      
      return res.json({ 
        parcels: parcelsWithoutHighway,
        warning: "Highway data file not found on server. Distances set to null."
      });
    }

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
        console.error(`Error processing parcel ${parcel.parcelId}:`, error.message);
        return {
          ...parcel,
          highwayDistance: null,
          highwayDistanceScore: null,
          _highwayError: error.message
        };
      }
    });

    // Count how many parcels got highway data
    const parcelsWithData = parcelsWithHighwayData.filter(p => p.highwayDistance !== null);
    console.log(`✅ Successfully calculated highway distances for ${parcelsWithData.length}/${parcels.length} parcels`);

    res.json({ 
      parcels: parcelsWithHighwayData,
      summary: {
        total: parcels.length,
        withHighwayData: parcelsWithData.length,
        withoutHighwayData: parcels.length - parcelsWithData.length
      }
    });
  } catch (error) {
    console.error('Error in highway distance calculation:', error);
    
    // Return parcels without highway data instead of failing completely
    const fallbackParcels = parcels.map(parcel => ({
      ...parcel,
      highwayDistance: null,
      highwayDistanceScore: null,
      _highwayError: "Engine error occurred"
    }));
    
    res.json({ 
      parcels: fallbackParcels,
      error: "Highway calculation failed, returning parcels without distance data",
      details: error.message
    });
  }
});

// Diagnostic endpoint to check highway data availability
app.get("/api/debug-highway/:county", (req, res) => {
  const { county } = req.params;
  const filePath = path.join(__dirname, "data", `roaddata_${county}.geojson`);
  
  const diagnostic = {
    county: county,
    filePath: filePath,
    fileExists: fs.existsSync(filePath),
    fileSize: null,
    canRead: false,
    engineLoaded: false,
    error: null
  };
  
  try {
    if (diagnostic.fileExists) {
      const stats = fs.statSync(filePath);
      diagnostic.fileSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      
      // Test if we can read the file
      try {
        const sample = fs.readFileSync(filePath, 'utf8').substring(0, 1000);
        diagnostic.canRead = true;
        diagnostic.sample = sample.substring(0, 200) + "...";
      } catch (readError) {
        diagnostic.error = `Cannot read file: ${readError.message}`;
      }
    }
    
    // Test if highway engine can be loaded
    try {
      const { getHighwayDistance } = require("./engine/highway");
      diagnostic.engineLoaded = true;
      
      // Test a simple distance calculation
      if (diagnostic.canRead) {
        const testResult = getHighwayDistance(34.0522, -81.0348, county);
        diagnostic.testResult = testResult;
      }
    } catch (engineError) {
      diagnostic.error = `Engine error: ${engineError.message}`;
    }
    
  } catch (error) {
    diagnostic.error = error.message;
  }
  
  res.json(diagnostic);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
