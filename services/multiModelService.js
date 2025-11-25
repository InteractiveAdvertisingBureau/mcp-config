import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { modelConfig } from "../config/config.js";

/**
 * Unified multi-model service that supports OpenAI and Gemini
 */
class MultiModelService {
  constructor() {
    // Initialize OpenAI if configured
    if (modelConfig.openai.enabled) {
      this.openai = new OpenAI({ apiKey: modelConfig.openai.apiKey });
    }

    // Initialize Gemini if configured
    if (modelConfig.gemini.enabled) {
      this.gemini = new GoogleGenerativeAI(modelConfig.gemini.apiKey);
    }
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    const models = [];

    if (modelConfig.openai.enabled) {
      models.push({
        provider: 'openai',
        name: 'OpenAI',
        model: modelConfig.openai.model,
        displayName: `OpenAI ${modelConfig.openai.model}`
      });
    }

    if (modelConfig.gemini.enabled) {
      models.push({
        provider: 'gemini',
        name: 'Google Gemini',
        model: modelConfig.gemini.model,
        displayName: `Google ${modelConfig.gemini.model}`
      });
    }

    return models;
  }

  /**
   * Generate chat completion with specified provider
   * @param {string} provider - 'openai' or 'gemini' or 'default'
   * @param {string} prompt - The prompt to send
   * @param {object} options - Additional options (temperature, maxTokens, jsonMode)
   */
  async generateCompletion(provider = 'default', prompt, options = {}) {
    console.log(`🔄 generateCompletion called - provider parameter: ${provider}`);

    // Resolve default provider
    if (provider === 'default') {
      provider = modelConfig.defaults.analysis;
      console.log(`⚙️  Resolved 'default' to: ${provider}`);
    }

    // Validate provider is enabled
    if (!modelConfig[provider]?.enabled) {
      throw new Error(`Provider "${provider}" is not configured or enabled. Please check your .env file.`);
    }

    const {
      temperature = 0.7,
      maxTokens = 2000,
      jsonMode = false
    } = options;

    console.log(`✅ Routing to provider: ${provider}`);

    // Route to appropriate provider
    if (provider === 'openai') {
      return await this._generateOpenAI(prompt, { temperature, maxTokens, jsonMode });
    } else if (provider === 'gemini') {
      return await this._generateGemini(prompt, { temperature, maxTokens, jsonMode });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Generate completion using OpenAI
   */
  async _generateOpenAI(prompt, options) {
    const { temperature, maxTokens, jsonMode } = options;

    const requestOptions = {
      model: modelConfig.openai.model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens
    };

    if (jsonMode) {
      requestOptions.response_format = { type: "json_object" };
    }

    const response = await this.openai.chat.completions.create(requestOptions);

    return {
      provider: 'openai',
      model: modelConfig.openai.model,
      content: response.choices[0].message.content,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      }
    };
  }

  /**
   * Generate completion using Gemini
   */
  async _generateGemini(prompt, options) {
    const { temperature, maxTokens, jsonMode } = options;

    const model = this.gemini.getGenerativeModel({
      model: modelConfig.gemini.model,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode && { responseMimeType: "application/json" })
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      provider: 'gemini',
      model: modelConfig.gemini.model,
      content: text,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  /**
   * Chat-specific method (uses default chat model)
   */
  async chat(prompt, options = {}) {
    const provider = options.provider || modelConfig.defaults.chat;
    return await this.generateCompletion(provider, prompt, options);
  }

  /**
   * Analysis-specific method (uses default analysis model)
   */
  async analyze(prompt, options = {}) {
    const provider = options.provider || modelConfig.defaults.analysis;
    console.log(`🤖 MultiModelService.analyze - Using provider: ${provider} (received: ${options.provider || 'not specified'})`);
    return await this.generateCompletion(provider, prompt, { ...options, jsonMode: true });
  }
}

// Export singleton instance
export const multiModelService = new MultiModelService();

// Export class for testing
export { MultiModelService };
