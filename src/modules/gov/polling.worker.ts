
// src/modules/gov/polling.worker.ts

// This worker handles the async status check for submitted invoices.
// It polls the LHDN API (via proxy) until a final status is reached.

import { tokenManager } from './token.manager';

export interface SubmissionStatus {
    uuid: string;
    status: 'Valid' | 'Invalid' | 'Submitted' | 'Processing';
    validationErrors?: any[];
}

export class PollingWorker {
    private intervalId: any = null;
    private callbacks: Map<string, (status: SubmissionStatus) => void> = new Map();

    constructor() {}

    public startPolling(uuid: string, onUpdate: (status: SubmissionStatus) => void) {
        this.callbacks.set(uuid, onUpdate);
        
        if (!this.intervalId) {
            this.intervalId = setInterval(() => this.checkStatuses(), 5000); // Check every 5 seconds
        }
    }

    public stopPolling(uuid: string) {
        this.callbacks.delete(uuid);
        if (this.callbacks.size === 0 && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkStatuses() {
        if (this.callbacks.size === 0) return;

        try {
            const token = await tokenManager.getAccessToken();

            for (const [uuid, callback] of this.callbacks.entries()) {
                try {
                    // Call Proxy to get document status
                    // Assuming proxy has an action 'status'
                    const response = await fetch(`/api/lhdn-proxy?action=status&uuid=${uuid}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Assuming data structure matches LHDN response
                        // status: "Valid" | "Invalid" | "Submitted"
                        
                        callback({
                            uuid,
                            status: data.status,
                            validationErrors: data.validationResults?.validationErrors
                        });

                        // Stop polling if final state
                        if (['Valid', 'Invalid', 'Rejected', 'Cancelled'].includes(data.status)) {
                            this.stopPolling(uuid);
                        }
                    }
                } catch (err) {
                    console.error(`Error polling UUID ${uuid}`, err);
                }
            }
        } catch (error) {
            console.error('Polling worker error:', error);
        }
    }
}

export const pollingWorker = new PollingWorker();
