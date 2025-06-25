const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:5000';

async function testHighwaySystem() {
  console.log('🧪 Testing Highway Distance System...\n');

  // Test 1: Debug endpoint
  console.log('1️⃣ Testing debug endpoint...');
  try {
    const debugResponse = await fetch(`${BASE_URL}/api/debug-highway/richland`);
    const debugData = await debugResponse.json();
    console.log('✅ Debug endpoint response:', debugData);
    
    if (debugData.fileExists) {
      console.log('✅ Highway data file exists');
    } else {
      console.log('⚠️ Highway data file not found');
    }
  } catch (error) {
    console.error('❌ Debug endpoint failed:', error.message);
  }

  // Test 2: Highway distance calculation
  console.log('\n2️⃣ Testing highway distance calculation...');
  try {
    const testParcels = [
      {
        parcelId: "TEST001",
        gps: { lat: 34.0522, lon: -81.0348 }, // Columbia coordinates
        owner: "Test Owner",
        address: "Test Address",
        acreage: 2.5,
        zoning: "GC",
        zoningFitScore: 7,
        investmentScore: 3,
        ownerType: "Individual",
        yearsOwned: 5
      }
    ];

    const highwayResponse = await fetch(`${BASE_URL}/api/parcels/richland/highway-distances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcels: testParcels })
    });

    const highwayData = await highwayResponse.json();
    console.log('✅ Highway calculation response:', highwayData);
    
    if (highwayData.warning) {
      console.log('⚠️ Warning:', highwayData.warning);
    }
    
    if (highwayData.error) {
      console.log('❌ Error:', highwayData.error);
    }
    
    if (highwayData.summary) {
      console.log('📊 Summary:', highwayData.summary);
    }
    
    const testParcel = highwayData.parcels[0];
    if (testParcel.highwayDistance) {
      console.log('✅ Highway distance calculated:', testParcel.highwayDistance);
    } else {
      console.log('⚠️ No highway distance data');
    }
    
  } catch (error) {
    console.error('❌ Highway calculation failed:', error.message);
  }

  // Test 3: Main parcels endpoint
  console.log('\n3️⃣ Testing main parcels endpoint...');
  try {
    const parcelsResponse = await fetch(`${BASE_URL}/api/parcels/richland`);
    if (parcelsResponse.ok) {
      console.log('✅ Main parcels endpoint working');
      
      // Read first few lines to check format
      const reader = parcelsResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let count = 0;
      
      while (count < 3) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.trim() && count < 3) {
            try {
              const parcel = JSON.parse(line);
              console.log(`📦 Parcel ${count + 1}:`, {
                parcelId: parcel.parcelId,
                hasHighwayDistance: parcel.highwayDistance !== null,
                highwayDistanceScore: parcel.highwayDistanceScore
              });
              count++;
            } catch (e) {
              console.warn('Malformed JSON line:', line);
            }
          }
        }
      }
    } else {
      console.error('❌ Main parcels endpoint failed:', parcelsResponse.status);
    }
  } catch (error) {
    console.error('❌ Main parcels endpoint failed:', error.message);
  }

  console.log('\n🎉 Testing completed!');
}

// Run the test
testHighwaySystem().catch(console.error); 