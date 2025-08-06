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
exports.OllamaProvider = void 0;
const base_1 = require("./base");
class OllamaProvider extends base_1.BaseLLM {
    getProviderName() {
        return 'ollama';
    }
    async validateConfig() {
        try {
            const { default: axios } = await Promise.resolve().then(() => __importStar(require('axios')));
            await axios.get('http://localhost:11434/api/tags');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async generatePlan(prompt) {
        const model = this.config.model || 'llama2:13b';
        try {
            const { default: axios } = await Promise.resolve().then(() => __importStar(require('axios')));
            const response = await axios.post('http://localhost:11434/api/generate', {
                model,
                prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 2000
                }
            });
            return {
                content: response.data.response,
                isStreaming: false
            };
        }
        catch (error) {
            console.error('Error generating plan with Ollama:', error);
            throw new Error('Failed to generate plan with Ollama. Make sure Ollama is running and the model is available.');
        }
    }
    async makeRequest(prompt) {
        // This method is not used in Ollama implementation
        // as we handle the request directly in generatePlan
        throw new Error('makeRequest not implemented for Ollama');
    }
}
exports.OllamaProvider = OllamaProvider;
//# sourceMappingURL=ollama.js.map