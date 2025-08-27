"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = void 0;
/**
 * Base provider class for all ticket/task providers
 * Provides common functionality for API authentication, request handling, and data mapping
 */
class BaseProvider {
    /**
     * Initialize provider with configuration
     * @param config Provider configuration including authentication details
     */
    constructor(config) {
        this.config = config;
    }
    /**
     * Generate authentication headers for API requests
     * @returns Object containing authentication headers
     */
    getAuthHeaders() {
        if (!this.config.token) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
        };
    }
    /**
     * Make authenticated HTTP request to provider API
     * @param url Target URL for the request
     * @param options Additional axios options (method, data, params, etc.)
     * @returns Promise resolving to response data
     * @throws Error if request fails or response is invalid
     */
    async makeRequest(url, options = {}) {
        const { default: axios } = await Promise.resolve().then(() => __importStar(require('axios')));
        try {
            const response = await axios({
                url,
                headers: {
                    ...this.getAuthHeaders(),
                    ...options.headers
                },
                timeout: 30000, // 30 second timeout
                ...options
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error making request to ${url}:`, error);
            // Re-throw with more context
            if (error.response) {
                const status = error.response.status;
                const statusText = error.response.statusText;
                throw new Error(`HTTP ${status} ${statusText}: Request to ${url} failed`);
            }
            else if (error.request) {
                throw new Error(`Network error: Unable to reach ${url}`);
            }
            else {
                throw new Error(`Request configuration error: ${error.message}`);
            }
        }
    }
}
exports.BaseProvider = BaseProvider;
//# sourceMappingURL=base.js.map