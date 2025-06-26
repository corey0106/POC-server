const path = require('path');

// Deployment configuration for different environments
const deploymentConfig = {
  // File paths for different deployment scenarios
  dataPaths: {
    // Local development
    local: [
      path.join(__dirname, 'data'),
      path.join(process.cwd(), 'server', 'data')
    ],
    
    // Docker deployment
    docker: [
      '/app/data',
      '/usr/src/app/data',
      path.join(process.cwd(), 'data')
    ],
    
    // Heroku deployment
    heroku: [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'server', 'data')
    ],
    
    // Vercel deployment
    vercel: [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'server', 'data')
    ],
    
    // Railway deployment
    railway: [
      path.join(process.cwd(), 'data'),
      '/app/data'
    ]
  },
  
  // File naming patterns
  filePatterns: {
    parcels: [
      '{county}_parcels.csv',
      '{county}_PARCELS.csv',
      '{county}-parcels.csv'
    ],
    highways: [
      'roaddata_{county}.geojson',
      'roaddata_{county}.geojson',
      'roaddata-{county}.geojson',
      'road_data_{county}.geojson',
      'highways_{county}.geojson'
    ]
  }
};

// Helper function to get all possible file paths
function getAllPossiblePaths(county, fileType) {
  const paths = [];
  const patterns = deploymentConfig.filePatterns[fileType];
  const dataPaths = deploymentConfig.dataPaths.local.concat(
    deploymentConfig.dataPaths.docker,
    deploymentConfig.dataPaths.heroku,
    deploymentConfig.dataPaths.vercel,
    deploymentConfig.dataPaths.railway
  );
  
  for (const dataPath of dataPaths) {
    for (const pattern of patterns) {
      const fileName = pattern
        .replace('{county}', county)
        .replace('{county}', county.toLowerCase())
        .replace('{county}', county.toUpperCase());
      
      paths.push(path.join(dataPath, fileName));
    }
  }
  
  return [...new Set(paths)]; // Remove duplicates
}

module.exports = {
  deploymentConfig,
  getAllPossiblePaths
}; 