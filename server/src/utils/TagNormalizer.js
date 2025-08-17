class TagNormalizer {
	/**
	 * Normalize tag name for consistent storage and comparison
	 */
	static normalizeTagName(tagName) {
		if (!tagName || typeof tagName !== 'string') {
			return '';
		}

		return tagName
			.toLowerCase()                    // Convert to lowercase: "Node.JS" → "node.js"
			.replace(/[.,\-_\s]+/g, '')      // Remove dots, commas, dashes, underscores, spaces: "node.js" → "nodejs"
			.replace(/\+/g, 'plus')          // Replace + with plus: "c++" → "cplus"
			.replace(/#+/g, 'sharp')         // Replace # with sharp: "c#" → "csharp"
			.replace(/[^\w]/g, '')           // Remove any remaining special characters
			.trim();
	}

	/**
	 * Check if two tag names are equivalent after normalization
	 */
	static areTagsEquivalent(tagName1, tagName2) {
		return this.normalizeTagName(tagName1) === this.normalizeTagName(tagName2);
	}

	/**
	 * Normalize multiple tags while preserving original names
	 */
	static normalizeTagList(tags) {
		return tags.map(tag => ({
			...tag,
			normalizedName: this.normalizeTagName(tag.name)
		}));
	}
}

module.exports = TagNormalizer;
