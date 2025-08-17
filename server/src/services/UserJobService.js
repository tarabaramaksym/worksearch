const ResponseFormatter = require('../utils/ResponseFormatter');

class UserJobService {
	constructor(userJobRepository, jobRepository) {
		this.userJobRepo = userJobRepository;
		this.jobRepo = jobRepository;
	}

	/**
	 * Create user job (save or apply to job)
	 */
	async createUserJob(userId, jobId, status = 'saved', notes = null) {
		try {
			// Check if job exists
			const job = await this.jobRepo.getById(jobId);
			if (!job) {
				const error = new Error('Job not found');
				error.statusCode = 404;
				throw error;
			}

			// Check if user already has this job
			const existingUserJob = await this.userJobRepo.findByUserAndJob(userId, jobId);
			if (existingUserJob) {
				const error = new Error('Job already added to your list');
				error.statusCode = 409;
				throw error;
			}

			// Create user job
			const userJob = await this.userJobRepo.create({
				user_id: userId,
				job_id: jobId,
				status,
				notes
			});

			return ResponseFormatter.formatCreated(userJob.user_job_id, 'Job added successfully');
		} catch (error) {
			if (error.statusCode) {
				throw error;
			}
			throw new Error(`Failed to add job: ${error.message}`);
		}
	}

	/**
	 * Update user job status and notes
	 */
	async updateUserJob(userId, userJobId, updateData) {
		try {
			// Verify the user job belongs to the user
			const userJob = await this.userJobRepo.getById(userJobId);
			if (!userJob) {
				const error = new Error('User job not found');
				error.statusCode = 404;
				throw error;
			}

			if (userJob.user_id !== userId) {
				const error = new Error('Unauthorized');
				error.statusCode = 403;
				throw error;
			}

			// Update user job
			await this.userJobRepo.updateUserJob(userJobId, updateData);

			return {
				success: true,
				message: 'Job updated successfully'
			};
		} catch (error) {
			if (error.statusCode) {
				throw error;
			}
			throw new Error(`Failed to update job: ${error.message}`);
		}
	}

	/**
	 * Get all jobs for user
	 */
	async getUserJobs(userId) {
		try {
			const userJobs = await this.userJobRepo.getAllByUserId(userId);
			return ResponseFormatter.formatList(userJobs, 'jobs');
		} catch (error) {
			throw new Error(`Failed to get user jobs: ${error.message}`);
		}
	}
}

module.exports = UserJobService;
