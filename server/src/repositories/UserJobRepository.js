const BaseRepository = require('./BaseRepository');

class UserJobRepository extends BaseRepository {
	constructor(dbService) {
		super(dbService, 'user_jobs', 'user_job_id');
	}

	/**
	 * Get all jobs for a specific user
	 */
	async getAllByUserId(userId) {
		const query = `
            SELECT uj.*, j.job_name, j.job_description, j.job_url, j.publication_date,
                   c.company_name, w.website_name
            FROM user_jobs uj
            JOIN jobs j ON uj.job_id = j.entity_id
            JOIN companies c ON j.company_id = c.company_id
            JOIN websites w ON j.website_id = w.website_id
            WHERE uj.user_id = ?
            ORDER BY uj.updated_at DESC
        `;
		return await this.db.all(query, [userId]);
	}

	/**
	 * Update user job status and notes
	 */
	async updateUserJob(userJobId, updateData) {
		const allowedFields = ['status', 'notes'];
		const filteredData = {};

		Object.keys(updateData).forEach(key => {
			if (allowedFields.includes(key)) {
				filteredData[key] = updateData[key];
			}
		});

		if (Object.keys(filteredData).length === 0) {
			throw new Error('No valid fields to update');
		}

		return await this.updateById(userJobId, filteredData);
	}

	/**
	 * Check if user already has this job
	 */
	async findByUserAndJob(userId, jobId) {
		const query = 'SELECT * FROM user_jobs WHERE user_id = ? AND job_id = ?';
		return await this.db.get(query, [userId, jobId]);
	}
}

module.exports = UserJobRepository;
