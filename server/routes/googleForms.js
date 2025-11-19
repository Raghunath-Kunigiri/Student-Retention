const express = require('express');
const https = require('https');
const { URL } = require('url');
const router = express.Router();

// Google Sheet ID and sheet name from the provided URL
const GOOGLE_SHEET_ID = '1g-3Q2jvwappOkJ0snKnh5tSvK6w-E9kxCDnzdD35JDE';
const SHEET_NAME = 'Form responses 1'; // Name of the tab containing form responses
const SHEET_GID = '2130650484'; // GID from the URL

/**
 * Fetch Google Form responses from Google Sheets
 * Filters by advisor name
 */
router.get('/responses', async (req, res) => {
  try {
    const { advisorName } = req.query;
    console.log('📋 Fetching Google Form responses...', { advisorName: advisorName || 'all' });

    // Try multiple export URL formats (order matters - most reliable first)
    // Method 1: Direct CSV export with GID (most reliable, less likely to redirect)
    const csvUrl1 = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    
    // Method 2: Direct CSV export without GID (uses first sheet)
    const csvUrl2 = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
    
    // Method 3: Using Google Visualization API with sheet name
    const encodedSheetName = encodeURIComponent(SHEET_NAME);
    const csvUrl3 = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
    
    // Method 4: Alternative export format
    const csvUrl4 = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&id=${GOOGLE_SHEET_ID}&gid=${SHEET_GID}`;
    
    // Try URLs in order until one works
    const urls = [csvUrl1, csvUrl2, csvUrl3, csvUrl4];
    let csvText = null;
    let lastError = null;
    
    // Helper function to follow redirects recursively
    const fetchWithRedirects = (urlString, maxRedirects = 5) => {
      return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects (max 5)'));
          return;
        }
        
        try {
          const urlObj = new URL(urlString);
          const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/csv,text/plain,*/*'
            },
            followRedirect: false // We'll handle redirects manually
          };
          
          const req = https.request(options, (response) => {
            console.log('📥 Response status:', response.statusCode, 'for URL:', urlString);
            
            // Handle redirects (301, 302, 307, 308)
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
              // Consume the response body to avoid connection leaks
              response.resume();
              
              const location = response.headers.location;
              if (location) {
                console.log('🔄 Redirect received:', response.statusCode, 'to:', location);
                
                // Handle relative and absolute redirects
                let redirectUrl;
                try {
                  if (location.startsWith('http://') || location.startsWith('https://')) {
                    redirectUrl = location;
                  } else if (location.startsWith('//')) {
                    redirectUrl = 'https:' + location;
                  } else if (location.startsWith('/')) {
                    redirectUrl = urlObj.protocol + '//' + urlObj.hostname + location;
                  } else {
                    // Relative path - construct from current URL
                    redirectUrl = new URL(location, urlString).toString();
                  }
                  
                  console.log('🔄 Following redirect to:', redirectUrl);
                  // Recursively follow redirect
                  fetchWithRedirects(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
                  return;
                } catch (urlError) {
                  reject(new Error(`Invalid redirect URL: ${location} - ${urlError.message}`));
                  return;
                }
              } else {
                reject(new Error(`Redirect received but no location header (${response.statusCode})`));
                return;
              }
            }
            
            if (response.statusCode !== 200) {
              // Check if it's an HTML error page (permissions issue)
              if (response.statusCode === 403 || response.statusCode === 404) {
                reject(new Error(`Sheet not accessible (${response.statusCode}). Please make the sheet publicly viewable.`));
                return;
              }
              reject(new Error(`Failed to fetch Google Sheet: ${response.statusCode} ${response.statusMessage}`));
              return;
            }
            
            let data = '';
            response.on('data', (chunk) => {
              data += chunk;
            });
            
            response.on('end', () => {
              // Check if we got HTML instead of CSV (permissions issue)
              if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html') || data.includes('<html')) {
                // Try to extract error message from HTML
                const errorMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i) || data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                const errorMsg = errorMatch ? errorMatch[1] : 'Access denied or sheet not found';
                reject(new Error(`Received HTML instead of CSV (${errorMsg}). The sheet may not be publicly accessible. Please: 1) Open the sheet, 2) Click Share, 3) Set to "Anyone with the link" can view, 4) Make sure the tab "Form responses 1" exists.`));
                return;
              }
              console.log('✅ CSV data received, length:', data.length);
              console.log('📄 First 200 chars:', data.substring(0, 200));
              resolve(data);
            });
          });
          
          req.on('error', (err) => {
            console.error('❌ HTTPS request error:', err);
            reject(err);
          });
          
          req.end();
        } catch (urlError) {
          reject(new Error(`Invalid URL: ${urlString} - ${urlError.message}`));
        }
      });
    };
    
    for (const csvUrl of urls) {
      try {
        console.log('📡 Trying URL:', csvUrl);
        csvText = await fetchWithRedirects(csvUrl);
        
        // If we got here, the request succeeded
        break;
      } catch (error) {
        console.log(`⚠️ URL failed: ${error.message}`);
        lastError = error;
        continue;
      }
    }
    
    if (!csvText) {
      throw new Error(`All export methods failed. Last error: ${lastError?.message || 'Unknown error'}. Please ensure the Google Sheet is publicly accessible (Share > Anyone with the link can view).`);
    }
    
    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('📊 CSV lines:', lines.length);
    console.log('📄 First line (header):', lines[0]?.substring(0, 200));
    
    if (lines.length === 0) {
      console.log('⚠️ No data in CSV - sheet might be empty');
      return res.json({ 
        responses: [], 
        total: 0, 
        totalAll: 0,
        message: 'Sheet is empty or has no data rows'
      });
    }
    
    if (lines.length === 1) {
      console.log('⚠️ Only header row found - no data rows');
      return res.json({ 
        responses: [], 
        total: 0, 
        totalAll: 0,
        message: 'Sheet has headers but no data rows yet'
      });
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 Headers found:', headers.length, headers.slice(0, 5));
    
    // Find advisor column index (optional, only needed if filtering)
    const advisorColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('advisor') || h.toLowerCase() === 'advisor'
    );
    console.log('👤 Advisor column index:', advisorColumnIndex);

    // Parse data rows
    const allResponses = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        if (values.length === 0) continue;
        
        const response = {};
        headers.forEach((header, index) => {
          response[header] = values[index] || '';
        });
        allResponses.push(response);
      } catch (err) {
        console.error(`⚠️ Error parsing line ${i}:`, err.message);
        // Continue with next line
      }
    }
    console.log('✅ Parsed responses:', allResponses.length);

    // Filter by advisor name if provided
    let responses = allResponses;
    if (advisorName && advisorColumnIndex !== -1) {
      responses = allResponses.filter(resp => {
        const rowAdvisorName = resp[headers[advisorColumnIndex]]?.trim();
        return rowAdvisorName && 
               rowAdvisorName.toLowerCase().includes(advisorName.toLowerCase());
      });
    }

    res.json({ 
      responses,
      total: responses.length,
      totalAll: allResponses.length,
      advisorName: advisorName || null,
      filtered: !!advisorName
    });

  } catch (error) {
    console.error('❌ Error fetching Google Form responses:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch Google Form responses',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Helper function to parse CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last value
  if (current || line.endsWith(',')) {
    values.push(current.trim());
  }
  
  return values;
}

/**
 * Test endpoint to verify sheet accessibility
 */
router.get('/test', async (req, res) => {
  try {
    const testUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
    console.log('🧪 Testing sheet accessibility:', testUrl);
    
    const csvText = await new Promise((resolve, reject) => {
      https.get(testUrl, (response) => {
        console.log('📥 Test response status:', response.statusCode);
        console.log('📥 Test response headers:', JSON.stringify(response.headers, null, 2));
        
        if (response.statusCode !== 200) {
          reject(new Error(`Status ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
            reject(new Error('Received HTML - sheet is not publicly accessible'));
            return;
          }
          resolve(data);
        });
      }).on('error', reject);
    });
    
    const lines = csvText.split('\n').filter(line => line.trim());
    res.json({
      success: true,
      message: 'Sheet is accessible!',
      csvLength: csvText.length,
      lineCount: lines.length,
      firstLine: lines[0]?.substring(0, 100),
      sheetId: GOOGLE_SHEET_ID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      sheetId: GOOGLE_SHEET_ID,
      help: 'Make sure the sheet is shared with "Anyone with the link" can view'
    });
  }
});

module.exports = router;

