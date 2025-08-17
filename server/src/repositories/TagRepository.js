const BaseRepository = require('./BaseRepository');
const TagNormalizer = require('../utils/TagNormalizer');

class TagRepository extends BaseRepository {
	constructor(dbService) {
		super(dbService, 'tags', 'tag_id');
	}

	/**
	 * Get or create tag by name using normalized name for lookup
	 */
	async getOrCreateByName(tagName, category = null) {
		const normalizedName = TagNormalizer.normalizeTagName(tagName);
		const data = {
			tag_name: tagName,
			normalized_name: normalizedName
		};
		if (category) {
			data.tag_category = category;
		}
		return await this.getOrCreate(data, ['normalized_name']);
	}

	/**
	 * Create multiple tags with categories using normalized names for deduplication
	 */
	async createTagsWithCategories(aiTags) {
		const tagIds = [];

		for (const tag of aiTags) {
			// Use normalized name for lookup
			const existingTag = await this.getBy('normalized_name', tag.normalizedName);
			if (existingTag) {
				tagIds.push(existingTag.tag_id);
			} else {
				const newTag = await this.create({
					tag_name: tag.name,
					normalized_name: tag.normalizedName,
					tag_category: tag.category
				});
				tagIds.push(newTag.tag_id);
			}
		}

		return tagIds;
	}

	/**
	 * Get all tags ordered by name
	 */
	async getAllOrderedByName() {
		return await this.getAll('tag_name');
	}

	/**
	 * Find tag by name using normalized lookup
	 */
	async findByName(tagName) {
		const normalizedName = TagNormalizer.normalizeTagName(tagName);
		return await this.getBy('normalized_name', normalizedName);
	}

	/**
	 * Find tag by exact tag name (for backward compatibility)
	 */
	async findByExactName(tagName) {
		return await this.getBy('tag_name', tagName);
	}
}

module.exports = TagRepository; 