/**
 * Prompt Loader Utility
 * Loads AI prompts from .prompt files in the prompts directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded prompts
const promptCache = new Map();

/**
 * Load a prompt from file
 * @param {string} category - Agent category (client, buyer, seller)
 * @param {string} name - Prompt name (e.g., 'goal-converter', 'autonomous-planner')
 * @returns {string} - Prompt content
 */
export function loadPrompt(category, name) {
  const cacheKey = `${category}/${name}`;

  // Return from cache if available
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey);
  }

  try {
    const promptsDir = path.join(__dirname, '../../prompts');
    const promptPath = path.join(promptsDir, category, `${name}.prompt`);

    if (!fs.existsSync(promptPath)) {
      console.warn(`⚠️  Prompt file not found: ${promptPath}`);
      return null;
    }

    const content = fs.readFileSync(promptPath, 'utf-8');

    // Cache the loaded prompt
    promptCache.set(cacheKey, content);

    console.log(`✅ Loaded prompt: ${category}/${name}`);
    return content;

  } catch (error) {
    console.error(`❌ Error loading prompt ${category}/${name}:`, error.message);
    return null;
  }
}

/**
 * Load all prompts for a category
 * @param {string} category - Agent category (client, buyer, seller)
 * @returns {Object} - Map of prompt names to content
 */
export function loadCategoryPrompts(category) {
  const prompts = {};

  try {
    const promptsDir = path.join(__dirname, '../../prompts');
    const categoryPath = path.join(promptsDir, category);

    if (!fs.existsSync(categoryPath)) {
      console.warn(`⚠️  Prompts category not found: ${category}`);
      return prompts;
    }

    const files = fs.readdirSync(categoryPath);

    files.forEach(file => {
      if (file.endsWith('.prompt')) {
        const name = file.replace('.prompt', '');
        const content = loadPrompt(category, name);
        if (content) {
          prompts[name] = content;
        }
      }
    });

    console.log(`✅ Loaded ${Object.keys(prompts).length} prompts for ${category}`);
    return prompts;

  } catch (error) {
    console.error(`❌ Error loading category prompts ${category}:`, error.message);
    return prompts;
  }
}

/**
 * Reload a specific prompt (useful for development)
 * @param {string} category - Agent category
 * @param {string} name - Prompt name
 * @returns {string} - Updated prompt content
 */
export function reloadPrompt(category, name) {
  const cacheKey = `${category}/${name}`;
  promptCache.delete(cacheKey);
  return loadPrompt(category, name);
}

/**
 * Clear all cached prompts
 */
export function clearPromptCache() {
  promptCache.clear();
  console.log('✅ Prompt cache cleared');
}

/**
 * Get prompt with variable substitution
 * @param {string} category - Agent category
 * @param {string} name - Prompt name
 * @param {Object} variables - Variables to substitute
 * @returns {string} - Prompt with variables substituted
 */
export function loadPromptWithVars(category, name, variables = {}) {
  let prompt = loadPrompt(category, name);

  if (!prompt) {
    return null;
  }

  // Substitute variables in format {{VAR_NAME}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    prompt = prompt.replace(regex, value);
  });

  return prompt;
}

/**
 * List all available prompts
 * @returns {Object} - Structure of available prompts
 */
export function listPrompts() {
  const structure = {};

  try {
    const promptsDir = path.join(__dirname, '../../prompts');
    const categories = fs.readdirSync(promptsDir);

    categories.forEach(category => {
      const categoryPath = path.join(promptsDir, category);
      const stat = fs.statSync(categoryPath);

      if (stat.isDirectory()) {
        const files = fs.readdirSync(categoryPath);
        structure[category] = files
          .filter(f => f.endsWith('.prompt'))
          .map(f => f.replace('.prompt', ''));
      }
    });

    return structure;

  } catch (error) {
    console.error('❌ Error listing prompts:', error.message);
    return structure;
  }
}
