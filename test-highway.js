const { getHighwayDistance, getHighwayDistanceScore, initializeHighwayCache } = require('./engine/highway');

// Test coordinates (Richland County, SC area)
const testCoordinates = [
  { lat: 34.0522, lon: -81.0348, description: "Columbia downtown area" },
  { lat: 34.0000, lon: -81.0000, description: "Richland County area" },
  { lat: 34.1000, lon: -81.1000, description: "Another Richland County area" }
];

console.log('🚀 Testing Highway Distance Calculation Engine...\n');

// Initialize cache
console.log('📋 Initializing highway cache...');
const highways = initializeHighwayCache('Richland');
console.log(`✅ Found ${highways ? highways.length : 0} highway segments\n`);

// Test distance calculations
testCoordinates.forEach((coord, index) => {
  console.log(`📍 Test ${index + 1}: ${coord.description}`);
  console.log(`   Coordinates: ${coord.lat}, ${coord.lon}`);
  
  const highwayInfo = getHighwayDistance(coord.lat, coord.lon, 'Richland');
  
  if (highwayInfo) {
    console.log(`   Nearest Highway: ${highwayInfo.roadName} (${highwayInfo.roadType})`);
    console.log(`   Distance: ${highwayInfo.distanceMiles.toFixed(2)} miles (${highwayInfo.distanceKm.toFixed(2)} km)`);
    
    const score = getHighwayDistanceScore(highwayInfo.distanceMiles);
    console.log(`   Highway Distance Score: ${score}/10`);
  } else {
    console.log(`   ❌ No highway data found`);
  }
  
  console.log('');
});

console.log('✅ Highway distance calculation test completed!'); 