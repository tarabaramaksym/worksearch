const ResponseFormatter = require('../utils/ResponseFormatter');

class DataService {
    constructor(repositories) {
        this.companyRepo = repositories.companyRepo;
        this.tagRepo = repositories.tagRepo;
        this.locationRepo = repositories.locationRepo;
        this.websiteRepo = repositories.websiteRepo;
    }

    /**
     * Get all tags
     */
    async getAllTags() {
        try {
            const tags = await this.tagRepo.getAllOrderedByName();
            return ResponseFormatter.formatList(tags, 'tags');
        } catch (error) {
            throw new Error(`Failed to get tags: ${error.message}`);
        }
    }

    /**
     * Create new tag
     */
    async createTag(tagData) {
        try {
            const { tag_name, tag_category } = tagData;
            
            if (!tag_name) {
                throw new Error('tag_name is required');
            }

            const newTag = await this.tagRepo.create({ tag_name, tag_category });
            return ResponseFormatter.formatCreated(newTag.tag_id, 'Tag created successfully');
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Tag already exists');
            }
            throw new Error(`Failed to create tag: ${error.message}`);
        }
    }

    /**
     * Get all companies
     */
    async getAllCompanies() {
        try {
            const companies = await this.companyRepo.getAllOrderedByName();
            return ResponseFormatter.formatList(companies, 'companies');
        } catch (error) {
            throw new Error(`Failed to get companies: ${error.message}`);
        }
    }

    /**
     * Create new company
     */
    async createCompany(companyData) {
        try {
            const { company_name, company_description, company_website, company_size } = companyData;
            
            if (!company_name) {
                throw new Error('company_name is required');
            }

            const newCompany = await this.companyRepo.create({
                company_name,
                company_description,
                company_website,
                company_size
            });
            
            return ResponseFormatter.formatCreated(newCompany.company_id, 'Company created successfully');
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Company already exists');
            }
            throw new Error(`Failed to create company: ${error.message}`);
        }
    }

    /**
     * Get all locations
     */
    async getAllLocations() {
        try {
            const locations = await this.locationRepo.getAllOrderedByName();
            return ResponseFormatter.formatList(locations, 'locations');
        } catch (error) {
            throw new Error(`Failed to get locations: ${error.message}`);
        }
    }

    /**
     * Create new location
     */
    async createLocation(locationData) {
        try {
            const { location } = locationData;
            
            if (!location) {
                throw new Error('location is required');
            }

            const newLocation = await this.locationRepo.create({ location });
            return ResponseFormatter.formatCreated(newLocation.location_id, 'Location created successfully');
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Location already exists');
            }
            throw new Error(`Failed to create location: ${error.message}`);
        }
    }

    /**
     * Get all websites
     */
    async getAllWebsites() {
        try {
            const websites = await this.websiteRepo.getAllActive();
            return ResponseFormatter.formatList(websites, 'websites');
        } catch (error) {
            throw new Error(`Failed to get websites: ${error.message}`);
        }
    }

    /**
     * Create new website
     */
    async createWebsite(websiteData) {
        try {
            const { website_name, website_url } = websiteData;
            
            if (!website_name || !website_url) {
                throw new Error('website_name and website_url are required');
            }

            const newWebsite = await this.websiteRepo.create({
                website_name,
                website_url
            });
            
            return ResponseFormatter.formatCreated(newWebsite.website_id, 'Website created successfully');
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Website URL already exists');
            }
            throw new Error(`Failed to create website: ${error.message}`);
        }
    }
}

module.exports = DataService; 