/**
 * Identity verification service for Noah-v2 SDK
 * Handles document uploads and credential issuance
 */

import { SDKConfig, DocumentInfo, CredentialRequest, CredentialResponse, AttesterInfo } from './types';

export class IdentityService {
    private attesterServiceUrl: string;

    constructor(config: SDKConfig) {
        this.attesterServiceUrl = config.attesterServiceUrl || 'http://localhost:8081';
    }

    /**
     * Verify a passport document via OCR
     * @param file Passport image file
     */
    async verifyPassport(file: File | Blob): Promise<{ success: boolean; data?: DocumentInfo; error?: string }> {
        const formData = new FormData();
        formData.append('passport', file);

        const response = await fetch(`${this.attesterServiceUrl}/passport/verify`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Passport verification failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data as { success: boolean; data?: DocumentInfo; error?: string };
    }

    /**
     * Internal helper to fetch with retry logic
     */
    private async fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (retries > 0 && response.status >= 500) {
                await new Promise(r => setTimeout(r, backoff));
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, backoff));
                return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw error;
        }
    }

    /**
     * Issue a new credential
     * @param request Credential issuance request
     */
    async issueCredential(request: CredentialRequest): Promise<CredentialResponse> {
        const response = await this.fetchWithRetry(`${this.attesterServiceUrl}/credential/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Credential issuance failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data as CredentialResponse;
    }

    /**
     * Get attester ID and public key
     */
    async getAttesterInfo(): Promise<AttesterInfo> {
        const response = await this.fetchWithRetry(`${this.attesterServiceUrl}/info`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to fetch attester info: ${response.statusText}`);
        }
        const data = await response.json() as any;
        return {
            attester_id: data.attester_id,
            public_key: data.public_key,
        };
    }
}
