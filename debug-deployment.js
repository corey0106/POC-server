const fs = require('fs');
const path = require('path');

console.log('🔍 Deployment Debug Script\n');

// Check current directory
console.log('📁 Current directory:', __dirname);
console.log('📁 Parent directory:', path.dirname(__dirname));

// Check if data directory exists
const dataDir = path.join(__dirname, 'data');
console.log('📁 Data directory path:', dataDir);
console.log('📁 Data directory exists:', fs.existsSync(dataDir));

if (fs.existsSync(dataDir)) {
  try {
    const files = fs.readdirSync(dataDir);
    console.log('📁 Files in data directory:', files);
    
    // Look for highway files
    const highwayFiles = files.filter(file => 
      file.toLowerCase().includes('road') && 
      file.toLowerCase().includes('richland')
    );
    console.log('🛣️ Potential highway files:', highwayFiles);
    
    // Check file sizes
    highwayFiles.forEach(file => {
      const filePath = path.join(dataDir, file);
      try {
        const stats = fs.statSync(filePath);
        console.log(`📊 ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Test if we can read the file
        try {
          const sample = fs.readFileSync(filePath, 'utf8').substring(0, 100);
          console.log(`✅ ${file}: Can read (sample: "${sample}...")`);
        } catch (readError) {
          console.log(`❌ ${file}: Cannot read - ${readError.message}`);
        }
      } catch (statError) {
        console.log(`❌ ${file}: Cannot stat - ${statError.message}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Cannot read data directory:', error.message);
  }
} else {
  console.log('❌ Data directory does not exist');
  
  // Check if we're in the right place
  const parentDataDir = path.join(path.dirname(__dirname), 'data');
  console.log('📁 Parent data directory path:', parentDataDir);
  console.log('📁 Parent data directory exists:', fs.existsSync(parentDataDir));
  
  if (fs.existsSync(parentDataDir)) {
    try {
      const files = fs.readdirSync(parentDataDir);
      console.log('📁 Files in parent data directory:', files);
    } catch (error) {
      console.error('❌ Cannot read parent data directory:', error.message);
    }
  }
}

console.log('\n🎉 Debug script completed!'); 