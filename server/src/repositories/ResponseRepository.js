const BaseRepository = require('./BaseRepository');

class ResponseRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'responses', 'response_id');
    }

    /**
     * Update response with auto-timestamp
     */
    async updateResponse(responseId, data) {
        const updateData = {
            ...data,
            response_date: new Date().toISOString()
        };
        return await this.update(responseId, updateData);
    }

    /**
     * Create response with auto-timestamp
     */
    async createResponse(data) {
        const responseData = {
            ...data,
            response_date: new Date().toISOString()
        };
        return await this.create(responseData);
    }
}

module.exports = ResponseRepository; 