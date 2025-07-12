const BaseRepository = require('./BaseRepository');

class WebsiteRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'websites', 'website_id');
    }

    /**
     * Get or create website by name and URL
     */
    async getOrCreateByName(websiteName, websiteUrl) {
        return await this.getOrCreate({ 
            website_name: websiteName, 
            website_url: websiteUrl 
        }, ['website_name']);
    }

    /**
     * Find website by name
     */
    async findByName(websiteName) {
        return await this.getBy('website_name', websiteName);
    }

    /**
     * Get all active websites
     */
    async getAllActive() {
        const query = 'SELECT * FROM websites WHERE is_active = 1 ORDER BY website_name';
        return await this.db.all(query);
    }
}

module.exports = WebsiteRepository; 