const ResponseFormatter = require('../utils/ResponseFormatter');

class JobService {
    constructor(repositories, aiService = null) {
        this.jobRepo = repositories.jobRepo;
        this.companyRepo = repositories.companyRepo;
        this.websiteRepo = repositories.websiteRepo;
        this.tagRepo = repositories.tagRepo;
        this.locationRepo = repositories.locationRepo;
        this.responseRepo = repositories.responseRepo;
        this.aiService = aiService;
    }

    /**
     * Get all jobs with formatting
     */
    async getAllJobs() {
        try {
            const jobs = await this.jobRepo.getAllWithRelations();
            return ResponseFormatter.formatJobsResponse(jobs);
        } catch (error) {
            throw new Error(`Failed to get jobs: ${error.message}`);
        }
    }

    /**
     * Get job by ID with formatting
     */
    async getJobById(id) {
        try {
            const job = await this.jobRepo.getByIdWithRelations(id);
            if (!job) {
                throw new Error('Job not found');
            }
            return ResponseFormatter.formatJobResponse(job);
        } catch (error) {
            throw new Error(`Failed to get job: ${error.message}`);
        }
    }

    /**
     * Search jobs with formatting
     */
    async searchJobs(filters) {
        try {
            const jobs = await this.jobRepo.searchJobs(filters);
            return ResponseFormatter.formatJobsResponse(jobs, filters);
        } catch (error) {
            throw new Error(`Failed to search jobs: ${error.message}`);
        }
    }

    /**
     * Check for duplicate job
     */
    async checkDuplicateJob(jobName, companyName) {
        try {
            const existingJob = await this.jobRepo.findDuplicateByNameAndCompany(jobName, companyName);
            
            if (existingJob) {
                return ResponseFormatter.formatDuplicateCheck(
                    true, 
                    `Job "${jobName}" already exists for company "${companyName}"`,
                    existingJob
                );
            } else {
                return ResponseFormatter.formatDuplicateCheck(false, 'No duplicate found');
            }
        } catch (error) {
            throw new Error(`Failed to check duplicate: ${error.message}`);
        }
    }

    /**
     * Create new job with all related data
     */
    async createJob(jobData) {
        try {
            const { 
                job_name, 
                job_description, 
                company_name, 
                company_id,
                publication_date,
                job_url,
                website_id,
                website_name,
                website_url,
                tags = [],
                location_ids = [],
                location
            } = jobData;

            // Validate required fields
            if (!job_name || (!company_name && !company_id)) {
                throw new Error('Missing required fields: job_name, (company_name or company_id)');
            }

            // Handle website
            let finalWebsiteId = website_id;
            if (!finalWebsiteId && website_name && website_url) {
                const website = await this.websiteRepo.getOrCreateByName(website_name, website_url);
                finalWebsiteId = website.website_id;
            }

            if (!finalWebsiteId) {
                throw new Error('Missing required fields: website_id or (website_name and website_url)');
            }

            // Handle company
            let finalCompanyId = company_id;
            if (!finalCompanyId && company_name) {
                const company = await this.companyRepo.getOrCreateByName(company_name);
                finalCompanyId = company.company_id;
            }

            // Check for duplicate
            const existingJob = await this.jobRepo.findDuplicateByNameAndCompany(job_name, company_name);
            if (existingJob) {
                const error = new Error(`Job "${job_name}" already exists for company "${company_name}"`);
                error.statusCode = 409;
                error.isDuplicate = true;
                error.existingJob = existingJob;
                throw error;
            }

            // Handle locations
            let finalLocationIds = Array.isArray(location_ids) ? location_ids.filter(Boolean) : [];
            if (finalLocationIds.length === 0 && location) {
                const locationRecord = await this.locationRepo.getOrCreateByName(location);
                finalLocationIds = [locationRecord.location_id];
            }

            // Create job
            const newJob = await this.jobRepo.create({
                job_name,
                job_description,
                company_id: finalCompanyId,
                publication_date,
                website_id: finalWebsiteId,
                job_url,
                applied: 0,
                failed_ai_request: 0
            });

            const jobId = newJob.entity_id;

            // Associate locations
            if (finalLocationIds.length > 0) {
                await this.jobRepo.associateLocations(jobId, finalLocationIds);
            }

            // Handle tags
            const warnings = [];
            let aiTagsSuccess = false;
            let manualTagsSuccess = false;

            // Generate AI tags
            if (job_description && job_description.trim() && this.aiService) {
                try {
                    aiTagsSuccess = await this.generateAndAssociateAITags(jobId, job_name, job_description);
                } catch (error) {
                    console.error('Error generating AI tags:', error);
                    warnings.push('AI tag generation failed');
                }
            }

            // Handle manual tags
            if (tags.length > 0) {
                try {
                    await this.handleManualTags(jobId, tags);
                    manualTagsSuccess = true;
                } catch (error) {
                    console.error('Error handling manual tags:', error);
                    warnings.push('Manual tag association failed');
                }
            } else {
                manualTagsSuccess = true;
            }

            // Update failed AI request flag
            if (!aiTagsSuccess && job_description && job_description.trim()) {
                await this.jobRepo.updateFailedAIRequest(jobId, true);
            }

            // Return response
            const message = warnings.length > 0 ? 'Job created with warnings' : 'Job created successfully';
            return ResponseFormatter.formatCreated(jobId, message, warnings);

        } catch (error) {
            throw new Error(`Failed to create job: ${error.message}`);
        }
    }

    /**
     * Generate and associate AI tags
     */
    async generateAndAssociateAITags(jobId, jobName, jobDescription) {
        if (!this.aiService) {
            console.log('⚠️ AI service not available, skipping tag generation');
            return false;
        }

        try {
            console.log(`🤖 Generating AI tags for job: ${jobName}`);
            const aiTags = await this.aiService.generateJobTags(jobName, jobDescription);
            
            if (aiTags.length === 0) {
                console.log('ℹ️ No tags generated by AI');
                return true;
            }

            console.log(`🏷️ Generated ${aiTags.length} tags:`, aiTags.map(t => `${t.name} (${t.category})`));

            // Create tags with categories
            const tagIds = await this.tagRepo.createTagsWithCategories(aiTags);
            
            // Associate with job
            await this.jobRepo.associateTags(jobId, tagIds);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to generate AI tags:', error);
            return false;
        }
    }

    /**
     * Handle manual tag association
     */
    async handleManualTags(jobId, tags) {
        const tagIds = [];
        
        for (const tagName of tags) {
            const tag = await this.tagRepo.getOrCreateByName(tagName);
            tagIds.push(tag.tag_id);
        }
        
        await this.jobRepo.associateTags(jobId, tagIds);
    }

    /**
     * Update job applied status
     */
    async updateJobApplied(id, applied) {
        try {
            const success = await this.jobRepo.updateAppliedStatus(id, applied);
            if (!success) {
                throw new Error('Job not found');
            }
            return ResponseFormatter.formatSuccess('Job applied status updated successfully');
        } catch (error) {
            throw new Error(`Failed to update job applied status: ${error.message}`);
        }
    }

    /**
     * Update job response
     */
    async updateJobResponse(id, responseData) {
        try {
            const job = await this.jobRepo.getById(id);
            if (!job) {
                throw new Error('Job not found');
            }

            let message;
            if (job.response_id) {
                await this.responseRepo.updateResponse(job.response_id, responseData);
                message = 'Response updated successfully';
            } else {
                const newResponse = await this.responseRepo.createResponse(responseData);
                await this.jobRepo.update(id, { response_id: newResponse.response_id });
                message = 'Response created and linked successfully';
            }

            return ResponseFormatter.formatSuccess(message);
        } catch (error) {
            throw new Error(`Failed to update job response: ${error.message}`);
        }
    }

    /**
     * Delete job
     */
    async deleteJob(id) {
        try {
            const success = await this.jobRepo.delete(id);
            if (!success) {
                throw new Error('Job not found');
            }
            return ResponseFormatter.formatSuccess('Job deleted successfully');
        } catch (error) {
            throw new Error(`Failed to delete job: ${error.message}`);
        }
    }

    /**
     * Get jobs with filters and dynamic filter options
     */
    async getJobsWithFilters(filters = {}) {
        try {
            const jobs = await this.jobRepo.searchJobs(filters);
            
            const filterOptions = this.calculateFilterOptions(jobs);
            
            return {
                jobs: ResponseFormatter.formatJobs(jobs),
                count: jobs.length,
                filters: filterOptions,
                appliedFilters: filters
            };
        } catch (error) {
            throw new Error(`Failed to get jobs with filters: ${error.message}`);
        }
    }

    /**
     * Calculate available filter options based on current job results
     */
    calculateFilterOptions(jobs) {
        const companies = new Set();
        const locations = new Set();
        const tagCategories = new Map();
        const websites = new Set();

        jobs.forEach(job => {
            if (job.company_name) {
                companies.add(job.company_name);
            }

            if (job.locations) {
                job.locations.split(',').forEach(location => {
                    if (location.trim()) locations.add(location.trim());
                });
            }

            if (job.tags) {
                job.tags.split(',').forEach(tag => {
                    const [tagName, tagCategory] = tag.split(':');
                    if (tagName.trim()) {
                        const category = tagCategory || 'other';
                        if (!tagCategories.has(category)) {
                            tagCategories.set(category, new Set());
                        }
                        tagCategories.get(category).add(tagName.trim());
                    }
                });
            }

            if (job.website_name) {
                websites.add(job.website_name);
            }
        });

        // Convert tag categories to sorted arrays
        const tagCategoryFilters = {};
        tagCategories.forEach((tagSet, category) => {
            tagCategoryFilters[category] = Array.from(tagSet).sort();
        });

        return {
            companies: Array.from(companies).sort(),
            locations: Array.from(locations).sort(),
            tagCategories: tagCategoryFilters,
            websites: Array.from(websites).sort()
        };
    }
}

module.exports = JobService; 