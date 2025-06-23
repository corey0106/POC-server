const zoningScores = {
    "HI": 10,           // Heavy Industrial - best for IOS
    "LI": 9,            // Light Industrial
    "M-1": 9,           // Light Industrial
    "EC": 8,            // Employment Campus
    "PD": 7,            // Planned Development (variable)
    "GC": 7,            // General Commercial
    "MU-1": 6,          // Mixed Use
    "MU-2": 6,
    "MC": 6,            // Mixed Commercial
    "CC-1": 6,          // Activity Center Mixed Use
    "CC-3": 6,
    "RAC": 6,           // Regional Activity Center Corridor
    "CAC": 6,           // Community Activity Center Corridor
    "NAC": 6,           // Neighborhood Activity Center Corridor
    "TC": 6,            // Town Center
    "DAC": 5,           // Downtown Activity Center
    "RM-1": 4,          // Residential Mixed
    "RM-2": 4,
    "R2": 2,            // Residential 2
    "R3": 2,
    "R4": 2,
    "R5": 2,
    "R6": 2,
    "RSF-1": 1,         // Residential Single Family Small Lot
    "RSF-2": 1,
    "RSF-3": 1,
    "INS": 1,           // Institutional
    "INS-GEN": 1,
    "MH": 1,            // Manufactured Home
    "AG": 3,            // Agricultural
    "RU": 3,            // Rural
    "HM": 1             // Homestead, treat as low score
  };
  
  function getZoningFitScore(zoningCode) {
    if (!zoningCode) {
      console.warn('Zoning code is missing');
      return null;
    }
    
    const score = zoningScores[zoningCode.toUpperCase()];
    
    if (score === undefined) {
      console.warn(`No zoning score found for code: ${zoningCode}`);
      return null;
    }
    
    return score;
  }
  
  module.exports = {
    getZoningFitScore
  };
  