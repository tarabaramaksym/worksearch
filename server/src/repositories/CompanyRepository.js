const BaseRepository = require('./BaseRepository');

class CompanyRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'companies', 'company_id');
    }

    /**
     * Get or create company by name
     */
    async getOrCreateByName(companyName) {
        return await this.getOrCreate({ company_name: companyName }, ['company_name']);
    }

    /**
     * Find company by name
     */
    async findByName(companyName) {
        return await this.getBy('company_name', companyName);
    }

    /**
     * Get all companies ordered by name
     */
    async getAllOrderedByName() {
        return await this.getAll('company_name');
    }
}

module.exports = CompanyRepository; 