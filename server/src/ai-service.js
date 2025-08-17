const OpenAI = require('openai/index.js');
const fs = require('fs');
const path = require('path');
const TagNormalizer = require('./utils/TagNormalizer');

class AIService {
	constructor(apiKey) {
		this.client = new OpenAI({
			apiKey: apiKey
		});
		this.systemMessage = this.loadPrompt('system-message.txt');
		this.tagGenerationPrompt = this.loadPrompt('tag-generation.txt');
	}

	/**
	 * Load prompt from file
	 */
	loadPrompt(filename) {
		try {
			const promptPath = path.join(__dirname, '..', 'prompts', filename);
			return fs.readFileSync(promptPath, 'utf8').trim();
		} catch (error) {
			console.error(`Error loading prompt file ${filename}:`, error);
			throw new Error(`Failed to load prompt file: ${filename}`);
		}
	}

	/**
	 * Generate tags for a job using AI
	 */
	async generateJobTags(jobName, jobDescription) {
		try {
			const prompt = this.buildTagGenerationPrompt(jobName, jobDescription);

			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content: this.systemMessage
					},
					{
						role: "user",
						content: prompt
					}
				],
				temperature: 0.3,
				max_tokens: 500
			});

			const content = response.choices[0].message.content.trim();
			const tags = JSON.parse(content);

			return this.formatTags(tags);

		} catch (error) {
			console.error('Error generating tags with AI:', error);
			throw error;
		}
	}

	/**
	 * Build the prompt for tag generation
	 */
	buildTagGenerationPrompt(jobName, jobDescription) {
		return this.tagGenerationPrompt
			.replace('{{JOB_NAME}}', jobName)
			.replace('{{JOB_DESCRIPTION}}', jobDescription);
	}

	/**
	 * Format tags from AI response into consistent format with normalization
	 */
	formatTags(tags) {
		const formattedTags = [];
		const seenNormalizedNames = new Set();

		for (const [category, tagList] of Object.entries(tags)) {
			if (Array.isArray(tagList)) {
				tagList.forEach(tagName => {
					if (tagName && typeof tagName === 'string') {
						const trimmedName = tagName.trim();
						const normalizedName = TagNormalizer.normalizeTagName(trimmedName);

						// Skip if we've already seen this normalized tag
						if (!seenNormalizedNames.has(normalizedName) && normalizedName) {
							seenNormalizedNames.add(normalizedName);
							formattedTags.push({
								name: trimmedName,
								normalizedName: normalizedName,
								category: category
							});
						}
					}
				});
			}
		}

		return formattedTags;
	}

	/**
	 * Test the AI service connection
	 */
	async testConnection() {
		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "user",
						content: "Say 'AI service is working' in exactly those words."
					}
				],
				max_tokens: 10
			});

			return response.choices[0].message.content.includes('AI service is working');
		} catch (error) {
			console.error('AI service connection test failed:', error);
			return false;
		}
	}
}

module.exports = AIService; 