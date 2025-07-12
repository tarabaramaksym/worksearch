const BaseRepository = require('./BaseRepository');

class JobRepository extends BaseRepository {
    constructor(dbService) {
        super(dbService, 'jobs', 'entity_id');
    }

    /**
     * Get all jobs with related data (companies, websites, tags, locations)
     */
    async getAllWithRelations() {
        const query = `
            SELECT 
                j.*,
                w.website_name,
                w.website_url,
                c.company_name,
                c.company_website,
                r.response_status,
                r.response_date,
                r.response_notes,
                GROUP_CONCAT(DISTINCT t.tag_name || ':' || COALESCE(t.tag_category, 'skill')) as tags,
                GROUP_CONCAT(DISTINCT l.location) as locations
            FROM jobs j
            LEFT JOIN websites w ON j.website_id = w.website_id
            LEFT JOIN companies c ON j.company_id = c.company_id
            LEFT JOIN responses r ON j.response_id = r.response_id
            LEFT JOIN job_tags jt ON j.entity_id = jt.job_id
            LEFT JOIN tags t ON jt.tag_id = t.tag_id
            LEFT JOIN job_locations jl ON j.entity_id = jl.job_id
            LEFT JOIN locations l ON jl.location_id = l.location_id
            GROUP BY j.entity_id
            ORDER BY j.created_at DESC
        `;
        
        return await this.db.all(query);
    }

    /**
     * Get job by ID with relations
     */
    async getByIdWithRelations(id) {
        const query = `
            SELECT 
                j.*,
                w.website_name,
                w.website_url,
                c.company_name,
                c.company_website,
                c.company_description,
                c.company_size,
                r.response_status,
                r.response_date,
                r.response_notes,
                r.contact_person,
                r.contact_email,
                r.interview_date,
                r.salary_offered,
                r.currency,
                GROUP_CONCAT(DISTINCT t.tag_name || ':' || COALESCE(t.tag_category, 'skill')) as tags,
                GROUP_CONCAT(DISTINCT l.location) as locations
            FROM jobs j
            LEFT JOIN websites w ON j.website_id = w.website_id
            LEFT JOIN companies c ON j.company_id = c.company_id
            LEFT JOIN responses r ON j.response_id = r.response_id
            LEFT JOIN job_tags jt ON j.entity_id = jt.job_id
            LEFT JOIN tags t ON jt.tag_id = t.tag_id
            LEFT JOIN job_locations jl ON j.entity_id = jl.job_id
            LEFT JOIN locations l ON jl.location_id = l.location_id
            WHERE j.entity_id = ?
            GROUP BY j.entity_id
        `;
        
        return await this.db.get(query, [id]);
    }

    /**
     * Search jobs with filters
     */
    async searchJobs(filters = {}) {
        const { q, job_name, job_description, company, applied, tags, website } = filters;
        
        let query = `
            SELECT DISTINCT
                j.*,
                w.website_name,
                w.website_url,
                c.company_name,
                r.response_status,
                r.response_date,
                GROUP_CONCAT(DISTINCT t.tag_name || ':' || COALESCE(t.tag_category, 'skill')) as tags,
                GROUP_CONCAT(DISTINCT l.location) as locations
            FROM jobs j
            LEFT JOIN websites w ON j.website_id = w.website_id
            LEFT JOIN companies c ON j.company_id = c.company_id
            LEFT JOIN responses r ON j.response_id = r.response_id
            LEFT JOIN job_tags jt ON j.entity_id = jt.job_id
            LEFT JOIN tags t ON jt.tag_id = t.tag_id
            LEFT JOIN job_locations jl ON j.entity_id = jl.job_id
            LEFT JOIN locations l ON jl.location_id = l.location_id
            WHERE 1=1
        `;

        const params = [];

        if (q) {
            query += ` AND (
                j.job_name LIKE ? OR 
                j.job_description LIKE ? OR 
                c.company_name LIKE ? OR
                t.tag_name LIKE ?
            )`;
            const searchTerm = `%${q}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (job_name) {
            query += ` AND j.job_name LIKE ?`;
            params.push(`%${job_name}%`);
        }

        if (job_description) {
            query += ` AND j.job_description LIKE ?`;
            params.push(`%${job_description}%`);
        }

        if (company) {
            query += ` AND c.company_name LIKE ?`;
            params.push(`%${company}%`);
        }

        if (applied !== undefined) {
            query += ` AND j.applied = ?`;
            params.push(applied === 'true' ? 1 : 0);
        }

        if (tags) {
            const tagList = tags.split(',').map(tag => tag.trim());
            const tagPlaceholders = tagList.map(() => '?').join(',');
            query += ` AND t.tag_name IN (${tagPlaceholders})`;
            params.push(...tagList);
        }

        if (website) {
            query += ` AND w.website_name LIKE ?`;
            params.push(`%${website}%`);
        }

        query += ` GROUP BY j.entity_id ORDER BY j.created_at DESC`;

        return await this.db.all(query, params);
    }

    /**
     * Check if job exists by name and company
     */
    async findDuplicateByNameAndCompany(jobName, companyName) {
        const query = `
            SELECT j.entity_id, j.job_name, c.company_name 
            FROM jobs j 
            JOIN companies c ON j.company_id = c.company_id 
            WHERE j.job_name = ? AND c.company_name = ?
        `;
        
        return await this.db.get(query, [jobName, companyName]);
    }

    /**
     * Check if job exists by name and company ID
     */
    async findDuplicateByNameAndCompanyId(jobName, companyId) {
        const query = `
            SELECT j.entity_id, j.job_name, c.company_name 
            FROM jobs j 
            JOIN companies c ON j.company_id = c.company_id 
            WHERE j.job_name = ? AND j.company_id = ?
        `;
        
        return await this.db.get(query, [jobName, companyId]);
    }

    /**
     * Update applied status
     */
    async updateAppliedStatus(id, applied) {
        const query = 'UPDATE jobs SET applied = ? WHERE entity_id = ?';
        const result = await this.db.run(query, [applied ? 1 : 0, id]);
        return result.changes > 0;
    }

    /**
     * Update failed AI request flag
     */
    async updateFailedAIRequest(id, failed = true) {
        const query = 'UPDATE jobs SET failed_ai_request = ? WHERE entity_id = ?';
        const result = await this.db.run(query, [failed ? 1 : 0, id]);
        return result.changes > 0;
    }

    /**
     * Associate job with tags
     */
    async associateTags(jobId, tagIds) {
        const queries = tagIds.map(tagId => ({
            query: 'INSERT OR IGNORE INTO job_tags (job_id, tag_id) VALUES (?, ?)',
            params: [jobId, tagId]
        }));
        
        return await this.db.transaction(queries);
    }

    /**
     * Associate job with locations
     */
    async associateLocations(jobId, locationIds) {
        const queries = locationIds.map(locationId => ({
            query: 'INSERT OR IGNORE INTO job_locations (job_id, location_id) VALUES (?, ?)',
            params: [jobId, locationId]
        }));
        
        return await this.db.transaction(queries);
    }
}

module.exports = JobRepository; 