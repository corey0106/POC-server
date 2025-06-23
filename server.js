const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const authRoutes = require("./routes/auth");
const { getZoningFitScore } = require("./engine/zoning");

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
  console.log(`✅ Server running on port ${PORT}`);
});
