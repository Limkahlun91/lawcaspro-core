
// src/modules/gov/token.manager.ts

// Since we cannot hold secrets on client, this manager calls our proxy.
// It handles token caching in memory (or secure storage if needed) to avoid excessive calls.

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

class TokenManager {
    private static instance: TokenManager;
    private accessToken: string | null = null;
    private expiryTime: number = 0;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<string> | null = null;

    private constructor() {}

    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    public async getAccessToken(): Promise<string> {
        // Check if token is valid (with buffer of 60 seconds)
        if (this.accessToken && Date.now() < this.expiryTime - 60000) {
            return this.accessToken;
        }

        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this.fetchNewToken();

        try {
            const token = await this.refreshPromise;
            this.isRefreshing = false;
            return token;
        } catch (error) {
            this.isRefreshing = false;
            throw error;
        }
    }

    private async fetchNewToken(): Promise<string> {
        try {
            // Call our proxy which holds the secrets
            // Rewrite Token Request: Use URLSearchParams (x-www-form-urlencoded)
            // The proxy itself has been updated to handle this, but the call to proxy remains simple GET/POST
            // The proxy handles the x-www-form-urlencoded construction to LHDN.
            
            const response = await fetch('/api/lhdn-proxy?action=token', {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Token fetch failed: ${JSON.stringify(errorData)}`);
            }

            const data: TokenResponse = await response.json();
            this.accessToken = data.access_token;
            // Set expiry time (expires_in is in seconds)
            this.expiryTime = Date.now() + (data.expires_in * 1000);
            
            console.log('LHDN Token Refreshed Successfully');
            return this.accessToken;
        } catch (error) {
            console.error('Error fetching LHDN token:', error);
            throw error;
        }
    }
}

export const tokenManager = TokenManager.getInstance();
