
export default async function handler(req, res) {
  const { action } = req.query;
  const LHDN_API_URL = 'https://preprod-api.myinvois.hasil.gov.my'; 
  const CLIENT_ID = '9fadad2d-975f-4232-afeb-e0e6aaa3131d';
  const CLIENT_SECRET = '4da532e8-cb0d-46e5-ad34-33c8fb11d125';

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (action === 'token') {
        // Rewrite Token Request: Use URLSearchParams (x-www-form-urlencoded)
        // This is critical to fix the 400 Bad Request error
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('grant_type', 'client_credentials');
        params.append('scope', 'InvoisApi'); // Updated scope based on SDK documentation

        const response = await fetch(`${LHDN_API_URL}/connect/token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('LHDN Token Failed:', data);
            return res.status(response.status).json({ 
                error: 'LHDN Token Error', 
                details: data
            });
        }

        return res.status(200).json(data);
    } 
    
    if (action === 'search') {
        const { idValue } = req.query;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'Missing Authorization Header' });
        }

        // Mock/Shim for Specific NRIC as per requirements
        if (idValue === '911216015285') {
            // Return specific TIN if match
            return res.status(200).json({
                tin: '23114448020',
                name: 'TEST TAXPAYER',
                type: 'Individual'
            });
        }

        // Real Call
        // Updated to use singular 'taxpayer' as per latest SDK documentation
        const url = `${LHDN_API_URL}/api/v1.0/taxpayer/search?idType=NRIC&idValue=${idValue}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 404) {
            console.log(`LHDN Search: No TIN found for ${idValue}`);
            return res.status(404).json({ message: 'Not Found' });
        }
        
        if (!response.ok) {
             const errorText = await response.text();
             console.error('LHDN Search Failed:', response.status, errorText);
             return res.status(response.status).json({ 
                 error: 'LHDN Search Error', 
                 details: errorText 
             });
        }

        const data = await response.json();
        return res.status(200).json(data);
    }

    if (action === 'status') {
        const { uuid } = req.query;
        const authHeader = req.headers.authorization;

        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization Header' });

        const url = `${LHDN_API_URL}/api/v1.0/documents/${uuid}/details`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
             return res.status(response.status).json({ error: 'Failed to fetch status' });
        }

        const data = await response.json();
        return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
