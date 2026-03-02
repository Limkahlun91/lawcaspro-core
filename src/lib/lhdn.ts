
// LHDN MyInvois Integration Library
// Implements Real API Connection via Vercel Proxy (Secure & CORS-Free)

// Base URL for internal API proxy
// In production (Vercel), this is relative '/api/lhdn-proxy'
// In development (Vite), this is proxied to Vercel via vite.config.ts or mocked
const PROXY_URL = '/api/lhdn-proxy';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * 1. 實裝 Token 獲取邏輯
 * Calls Serverless Function to get Token securely
 */
export async function getLHDNToken(): Promise<string> {
  // Return cached token if valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  console.log('LHDN Auth: Requesting new Access Token via Proxy...');
  
  try {
    const response = await fetch(`${PROXY_URL}?action=token`, {
      method: 'GET', // Or POST if preferred, but GET is fine for triggering the action
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LHDN Token Proxy Error:', errorData);
      
      const errorMessage = errorData.details?.error_description || JSON.stringify(errorData.details || errorData);
      
      // 3. UI 降級邏輯 (Fallback)
      if (confirm(`系統連接 LHDN 失敗 (Status: ${response.status})。\n是否暫時使用通用稅號 EI00000000010？`)) {
          throw new Error('FALLBACK_TIN');
      }
      
      throw new Error(`Failed to get token from proxy: ${errorMessage}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Buffer 60s

    return accessToken as string;
  } catch (error) {
    console.error('LHDN Token Connection Failed:', error);
    throw error;
  }
}

/**
 * 2. 鎖死 TIN 查詢函數
 * Call LHDN taxpayers/search via Proxy
 */
export async function lookupTIN(idValue: string): Promise<any> {
  try {
    const token = await getLHDNToken();

    console.log(`LHDN API: Searching TIN for NRIC - ${idValue} via Proxy`);
    
    const url = `${PROXY_URL}?action=search&idValue=${idValue}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`, // Pass token to proxy
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 404) {
       // Not Found
       return null;
    }

    if (!response.ok) {
        if (response.status === 401) {
            console.error('401 Unauthorized - Token might be invalid or expired.');
            accessToken = null; 
        }
        throw new Error(`LHDN Search Proxy Failed: ${response.status}`);
    }

    const data = await response.json();
    // 3. 廢除模擬數據 (Kill Mock Data)
    // Return actual API response
    return data;

  } catch (error) {
    console.error('LHDN Lookup Error:', error);
    throw error;
  }
}
