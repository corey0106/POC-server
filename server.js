const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const zoningScores = {
  "LI": 5,          
  "HI": 4,          
  "B2": 3,          
  "AG": 2,          
  "R1": 1,          
  "Residential": 0  
};

const landUseToZoning = {
  "RIO": "LI",       
  "RV": "HI",        
  "RIL": "B2",       
  "CI": "AG",        
  "FUV": "R1",       
  "EI": "Residential", 
  "EV": "Residential"  
};

function getZoningFitScore(landUseCode) {
  const zoningCategory = landUseToZoning[landUseCode];
  if (!zoningCategory) {
    console.warn(`No zoning mapping found for land use code: ${landUseCode}`);
    return null; 
  }
  return zoningScores[zoningCategory];
}

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
  if(parcel.acreage > 1 && parcel.acreage < 5) score += 1;
  if(parcel.zoningFitScore >= 4) score += 2;
  if(parcel.ownerType === "Entity") score += 1;
  if((parcel.yearsOwned ?? 0) > 10) score +=1;
  return score;
}

app.get("/api/parcels/:county", (req, res) => {
  const { county } = req.params;
  const filePath = path.join(__dirname, "data", `${county}_parcels.csv`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "CSV file not found" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");

  const stream = fs.createReadStream(filePath)
    .pipe(csv());

  stream.on("data", (row) => {
    const ownerName = row["Owner Name"] || "Unknown";

    const parcel = {
      parcelId: row["Tax Parcel ID"] || row["Land Parcel Number"] || "Unknown",
      owner: ownerName,
      address: row["Mailing Address Line 1"] || "N/A",
      acreage: parseFloat(row["Deeded Acres"]) || 0,
      zoning: row["Current Land Use Code"] || "Unknown",
      gps: {
        lat: null,
        lon: null,
      },
      assessedValue: parseFloat(row["Total Assessed Value"]) || 0,
      zoningFitScore: getZoningFitScore(row["Current Land Use Code"]),
      investmentScore: null,
      ownerType: getOwnerType(ownerName),
      yearsOwned: getYearsOwned(row["Date Sold"]),
      contactInfo: null
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

app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});
