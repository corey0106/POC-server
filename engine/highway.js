const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

// Simple distance calculation using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Calculate distance from point to line segment
function pointToLineDistance(point, lineStart, lineEnd) {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Line segment is actually a point
    return Math.sqrt(A * A + B * B);
  }
  
  let param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Load and cache highway data
let highwayData = null;
let highwayCache = null;

function loadHighwayData(county) {
  if (highwayData) return highwayData;
  
  // Try multiple possible file paths
  const possiblePaths = [
    path.join(__dirname, '..', 'data', `roaddata_${county}.geojson`),
    path.join(__dirname, '..', 'data', `roaddata_${county.toLowerCase()}.geojson`),
    path.join(__dirname, '..', 'data', `roaddata_${county.toUpperCase()}.geojson`),
    path.join(__dirname, '..', 'data', `roaddata-${county}.geojson`),
    path.join(__dirname, '..', 'data', `roaddata-${county.toLowerCase()}.geojson`),
    path.join(__dirname, '..', 'data', `roaddata-${county.toUpperCase()}.geojson`),
    path.join(__dirname, '..', 'data', `road_data_${county}.geojson`),
    path.join(__dirname, '..', 'data', `road_data_${county.toLowerCase()}.geojson`),
    path.join(__dirname, '..', 'data', `road_data_${county.toUpperCase()}.geojson`)
  ];
  
  let filePath = null;
  let foundPath = null;
  
  console.log(`🔍 Looking for highway data file for ${county} county...`);
  
  for (const testPath of possiblePaths) {
    console.log(`  Checking: ${testPath}`);
    if (fs.existsSync(testPath)) {
      filePath = testPath;
      foundPath = testPath;
      console.log(`✅ Found file at: ${foundPath}`);
      break;
    }
  }
  
  if (!filePath) {
    // If no file found, let's check what's actually in the data directory
    const dataDir = path.join(__dirname, '..', 'data');
    if (fs.existsSync(dataDir)) {
      try {
        const files = fs.readdirSync(dataDir);
        console.log(`📁 Available files in data directory:`, files);
        
        // Look for any file that might be highway data
        const potentialFiles = files.filter(file => 
          file.toLowerCase().includes('road') && 
          file.toLowerCase().includes('richland') &&
          file.toLowerCase().endsWith('.geojson')
        );
        
        if (potentialFiles.length > 0) {
          console.log(`🔍 Found potential highway files:`, potentialFiles);
          filePath = path.join(dataDir, potentialFiles[0]);
          foundPath = filePath;
          console.log(`✅ Using alternative file: ${foundPath}`);
        }
      } catch (error) {
        console.error(`❌ Cannot read data directory:`, error.message);
      }
    }
    
    if (!filePath) {
      console.error(`❌ No highway data file found for ${county} county`);
      console.error(`❌ Tried paths:`, possiblePaths);
      return null;
    }
  }
  
  try {
    console.log(`📖 Reading highway data file: ${foundPath}`);
    const rawData = fs.readFileSync(foundPath, 'utf8');
    console.log(`📊 Parsing JSON data...`);
    highwayData = JSON.parse(rawData);
    console.log(`✅ Loaded highway data for ${county} county with ${highwayData.features?.length || 0} features`);
    return highwayData;
  } catch (error) {
    console.error('❌ Error loading highway data:', error);
    return null;
  }
}

// Initialize highway cache for faster lookups
function initializeHighwayCache(county) {
  if (highwayCache) return highwayCache;
  
  const data = loadHighwayData(county);
  if (!data || !data.features) {
    console.warn('No highway features found in data');
    return null;
  }
  
  highwayCache = data.features
    .filter(feature => {
      // Filter for highway/road features using OpenStreetMap properties
      const properties = feature.properties || {};
      const highwayType = properties.highway || '';
      const ref = properties.ref || '';
      const name = properties.name || properties.alt_name || '';
      
      // Include major road types
      const majorRoadTypes = [
        'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
        'motorway_link', 'trunk_link', 'primary_link', 'secondary_link'
      ];
      
      // Include highways with specific references
      const highwayRefs = ['I-', 'US-', 'SC-', 'I ', 'US ', 'SC '];
      
      return majorRoadTypes.includes(highwayType) || 
             highwayRefs.some(refPrefix => ref.includes(refPrefix)) ||
             name.toLowerCase().includes('highway') ||
             name.toLowerCase().includes('interstate');
    })
    .map(feature => {
      const geometry = feature.geometry;
      if (geometry.type === 'LineString') {
        return {
          coordinates: geometry.coordinates,
          properties: feature.properties,
          turfLine: turf.lineString(geometry.coordinates)
        };
      } else if (geometry.type === 'MultiLineString') {
        return geometry.coordinates.map(coords => ({
          coordinates: coords,
          properties: feature.properties,
          turfLine: turf.lineString(coords)
        }));
      }
      return null;
    })
    .filter(Boolean)
    .flat();
  
  console.log(`✅ Cached ${highwayCache.length} highway segments for ${county} county`);
  return highwayCache;
}

// Calculate distance to nearest highway using turf.js
function getHighwayDistance(lat, lon, county = 'Richland') {
  if (!lat || !lon || lat === 'Unknown' || lon === 'Unknown') {
    return null;
  }
  
  try {
    const highways = initializeHighwayCache(county);
    if (!highways || highways.length === 0) {
      console.warn('No highway data available for distance calculation');
      return null;
    }
    
    let minDistance = Infinity;
    let nearestHighway = null;
    
    // Create a point from the parcel coordinates
    const parcelPoint = turf.point([parseFloat(lon), parseFloat(lat)]);
    
    for (const highway of highways) {
      try {
        // Calculate distance from point to line using turf.js
        const distance = turf.pointToLineDistance(parcelPoint, highway.turfLine, { units: 'miles' });
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestHighway = {
            distance: distance,
            distanceMiles: distance,
            distanceKm: distance * 1.60934, // Convert miles to kilometers
            roadName: highway.properties.name || highway.properties.alt_name || highway.properties.ref || 'Unknown',
            roadType: highway.properties.highway || 'Unknown'
          };
        }
      } catch (error) {
        console.warn('Error calculating distance for highway segment:', error.message);
        continue;
      }
    }
    
    return nearestHighway;
  } catch (error) {
    console.error('Error in getHighwayDistance:', error.message);
    return null;
  }
}

// Get highway distance score (0-10 scale)
function getHighwayDistanceScore(distanceMiles) {
  if (!distanceMiles || distanceMiles === null) return null;
  
  if (distanceMiles <= 0.5) return 10;      // Very close to highway
  if (distanceMiles <= 1) return 9;         // Close to highway
  if (distanceMiles <= 2) return 8;         // Near highway
  if (distanceMiles <= 3) return 7;         // Reasonable distance
  if (distanceMiles <= 5) return 6;         // Moderate distance
  if (distanceMiles <= 10) return 4;        // Far from highway
  if (distanceMiles <= 20) return 2;        // Very far from highway
  return 1;                                 // Extremely far from highway
}

module.exports = {
  getHighwayDistance,
  getHighwayDistanceScore,
  loadHighwayData,
  initializeHighwayCache
}; 