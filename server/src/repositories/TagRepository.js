const BaseRepository = require('./BaseRepository');

class TagRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'tags', 'tag_id');
    }

    /**
     * Get or create tag by name
     */
    async getOrCreateByName(tagName, category = null) {
        const data = { tag_name: tagName };
        if (category) {
            data.tag_category = category;
        }
        return await this.getOrCreate(data, ['tag_name']);
    }

    /**
     * Create multiple tags with categories
     */
    async createTagsWithCategories(aiTags) {
        const tagIds = [];
        
        for (const tag of aiTags) {
            const existingTag = await this.getBy('tag_name', tag.name);
            if (existingTag) {
                tagIds.push(existingTag.tag_id);
            } else {
                const newTag = await this.create({
                    tag_name: tag.name,
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
     * Find tag by name
     */
    async findByName(tagName) {
        return await this.getBy('tag_name', tagName);
    }
}

module.exports = TagRepository; 