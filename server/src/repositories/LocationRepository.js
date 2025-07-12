const BaseRepository = require('./BaseRepository');

class LocationRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'locations', 'location_id');
    }

    /**
     * Get or create location by name
     */
    async getOrCreateByName(locationName) {
        return await this.getOrCreate({ location: locationName }, ['location']);
    }

    /**
     * Find location by name
     */
    async findByName(locationName) {
        return await this.getBy('location', locationName);
    }

    /**
     * Get all locations ordered by name
     */
    async getAllOrderedByName() {
        return await this.getAll('location');
    }
}

module.exports = LocationRepository; 