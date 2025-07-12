const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const DatabaseInitializer = require('./init.js');
const AIService = require('./ai-service.js');

class JobDashboardAPI {
    constructor(dbPath = './data/job_dashboard.db') {
        this.app = express();
        this.dbPath = dbPath;
        this.aiService = null;
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeAIService();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        this.app.get('/api/jobs', this.getAllJobs.bind(this));
        this.app.get('/api/jobs/search', this.searchJobs.bind(this));
        this.app.get('/api/jobs/:id', this.getJobById.bind(this));
        this.app.post('/api/jobs', this.createJob.bind(this));
        this.app.put('/api/jobs/:id/applied', this.updateJobApplied.bind(this));
        this.app.put('/api/jobs/:id/response', this.updateJobResponse.bind(this));
        this.app.delete('/api/jobs/:id', this.deleteJob.bind(this));

        this.app.post('/api/jobs/check-duplicate', this.checkDuplicateJob.bind(this));

        this.app.get('/api/tags', this.getAllTags.bind(this));
        this.app.get('/api/websites', this.getAllWebsites.bind(this));
        this.app.get('/api/companies', this.getAllCompanies.bind(this));
        this.app.get('/api/locations', this.getAllLocations.bind(this));
        this.app.post('/api/tags', this.createTag.bind(this));
        this.app.post('/api/websites', this.createWebsite.bind(this));
        this.app.post('/api/companies', this.createCompany.bind(this));
        this.app.post('/api/locations', this.createLocation.bind(this));

        this.app.use(this.errorHandler.bind(this));
    }

    /**
     * Initialize AI service with API key
     */
    initializeAIService() {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (apiKey) {
            this.aiService = new AIService(apiKey);
            console.log('🤖 AI service initialized');
        } else {
            console.log('⚠️ No OpenAI API key provided, AI features disabled');
        }
    }

    /**
     * Connect to database
     */
    async connectDB() {
        try {
            const dbExists = fs.existsSync(this.dbPath);
            
            if (!dbExists) {
                console.log('📊 Database not found, initializing...');
                
                const dataDir = path.dirname(this.dbPath);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                    console.log(`📁 Created directory: ${dataDir}`);
                }
                
                const initializer = new DatabaseInitializer(this.dbPath);
                await initializer.initialize();
                console.log('✅ Database initialized successfully');
            }

            return new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('🔗 Connected to SQLite database');
                        this.db.run('PRAGMA foreign_keys = ON');
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('Error connecting to database:', error);
            throw error;
        }
    }

    /**
     * Get all jobs with related data
     */
    async getAllJobs(req, res) {
        try {
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

            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error fetching jobs:', err);
                    return res.status(500).json({ error: 'Failed to fetch jobs' });
                }

                const jobs = rows.map(row => ({
                    ...row,
                    tags: row.tags ? row.tags.split(',').map(tag => {
                        const [name, category] = tag.split(':');
                        return { name, category };
                    }) : [],
                    locations: row.locations ? row.locations.split(',') : [],
                    applied: Boolean(row.applied)
                }));

                res.json({ jobs, count: jobs.length });
            });
        } catch (error) {
            console.error('Error in getAllJobs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get specific job by ID
     */
    async getJobById(req, res) {
        try {
            const jobId = req.params.id;

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

            this.db.get(query, [jobId], (err, row) => {
                if (err) {
                    console.error('Error fetching job:', err);
                    return res.status(500).json({ error: 'Failed to fetch job' });
                }

                if (!row) {
                    return res.status(404).json({ error: 'Job not found' });
                }

                const job = {
                    ...row,
                    tags: row.tags ? row.tags.split(',').map(tag => {
                        const [name, category] = tag.split(':');
                        return { name, category };
                    }) : [],
                    locations: row.locations ? row.locations.split(',') : [],
                    applied: Boolean(row.applied)
                };

                res.json({ job });
            });
        } catch (error) {
            console.error('Error in getJobById:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Search jobs with general or specific queries
     */
    async searchJobs(req, res) {
        try {
            const { q, job_name, job_description, company, applied, tags, website } = req.query;

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

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error searching jobs:', err);
                    return res.status(500).json({ error: 'Failed to search jobs' });
                }

                const jobs = rows.map(row => ({
                    ...row,
                    tags: row.tags ? row.tags.split(',').map(tag => {
                        const [name, category] = tag.split(':');
                        return { name, category };
                    }) : [],
                    locations: row.locations ? row.locations.split(',') : [],
                    applied: Boolean(row.applied)
                }));

                res.json({ jobs, count: jobs.length, query: req.query });
            });
        } catch (error) {
            console.error('Error in searchJobs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Check if job already exists with same company and job name
     */
    async checkJobDuplicate(jobName, companyIdentifier) {
        return new Promise((resolve, reject) => {
            let query, params;
            
            // If companyIdentifier is a number, treat as company ID
            if (typeof companyIdentifier === 'number' || !isNaN(companyIdentifier)) {
                query = `
                    SELECT j.entity_id, j.job_name, c.company_name 
                    FROM jobs j 
                    JOIN companies c ON j.company_id = c.company_id 
                    WHERE j.job_name = ? AND j.company_id = ?
                `;
                params = [jobName, companyIdentifier];
            } else {
                // If companyIdentifier is a string, treat as company name
                query = `
                    SELECT j.entity_id, j.job_name, c.company_name 
                    FROM jobs j 
                    JOIN companies c ON j.company_id = c.company_id 
                    WHERE j.job_name = ? AND c.company_name = ?
                `;
                params = [jobName, companyIdentifier];
            }
            
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Check if job already exists by job name and company name
     * @param {string} jobName - The job name to check
     * @param {string} companyName - The company name to check
     * @returns {Promise<Object|null>} - Existing job data or null if not found
     */
    async checkJobDuplicateByName(jobName, companyName) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT j.entity_id, j.job_name, c.company_name 
                FROM jobs j 
                JOIN companies c ON j.company_id = c.company_id 
                WHERE j.job_name = ? AND c.company_name = ?
            `;
            
            this.db.get(query, [jobName, companyName], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Check for job duplicate via API endpoint
     */
    async checkDuplicateJob(req, res) {
        try {
            const { job_name, company_name, job_url } = req.body;

            if (!job_name || !company_name) {
                return res.status(400).json({ 
                    error: 'Missing required fields: job_name, company_name' 
                });
            }

            const existingJob = await this.checkJobDuplicateByName(job_name, company_name);
            
            if (existingJob) {
                return res.json({
                    isDuplicate: true,
                    message: `Job "${job_name}" already exists for company "${company_name}"`,
                    existingJob: {
                        id: existingJob.entity_id,
                        job_name: existingJob.job_name,
                        company_name: existingJob.company_name
                    }
                });
            } else {
                return res.json({
                    isDuplicate: false,
                    message: 'No duplicate found'
                });
            }

        } catch (error) {
            console.error('Error in checkDuplicateJob:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Create new job
     */
    async createJob(req, res) {
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
                location_ids = []
            } = req.body;

            if (!job_name || (!company_name && !company_id)) {
                return res.status(400).json({ 
                    error: 'Missing required fields: job_name, (company_name or company_id)' 
                });
            }

            let finalWebsiteId = website_id;
            if (!finalWebsiteId && website_name) {
                const existingWebsite = await new Promise((resolve, reject) => {
                    this.db.get('SELECT website_id FROM websites WHERE website_name = ?', [website_name], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (existingWebsite) {
                    finalWebsiteId = existingWebsite.website_id;
                } else if (website_url) {
                    // Create new website
                    finalWebsiteId = await new Promise((resolve, reject) => {
                        this.db.run('INSERT INTO websites (website_name, website_url) VALUES (?, ?)', 
                            [website_name, website_url], function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        });
                    });
                }
            }

            if (!finalWebsiteId) {
                return res.status(400).json({ 
                    error: 'Missing required fields: website_id or (website_name and website_url)' 
                });
            }

            let finalCompanyId = company_id;
            if (!finalCompanyId && company_name) {
                finalCompanyId = await this.getOrCreateCompany(company_name);
            }

            // Check for duplicate job - prefer company name check if available
            let existingJob;
            if (company_name) {
                existingJob = await this.checkJobDuplicateByName(job_name, company_name);
            } else {
                existingJob = await this.checkJobDuplicate(job_name, finalCompanyId);
            }
            if (existingJob) {
                return res.status(409).json({ 
                    error: 'Job already exists',
                    message: `Job "${job_name}" already exists for company "${existingJob.company_name}"`,
                    existing_job_id: existingJob.entity_id
                });
            }

            // Handle locations (similar to company handling)
            let finalLocationIds = Array.isArray(location_ids) ? location_ids.filter(Boolean) : [];
            
            // If no location_ids provided but location string is provided, convert it
            if (finalLocationIds.length === 0 && req.body.location) {
                try {
                    const locationId = await this.getOrCreateLocations(req.body.location);
                    finalLocationIds = [locationId];
                } catch (error) {
                    console.error('Error creating location:', error);
                }
            }

            const insertJobQuery = `
                INSERT INTO jobs (job_name, job_description, company_id, publication_date, website_id, job_url, applied, failed_ai_request)
                VALUES (?, ?, ?, ?, ?, ?, 0, 0)
            `;

            const self = this;

            this.db.run(insertJobQuery, [
                job_name, 
                job_description, 
                finalCompanyId, 
                publication_date,
                finalWebsiteId,
                job_url
            ], function(err) {
                if (err) {
                    console.error('Error creating job:', err);
                    return res.status(500).json({ error: 'Failed to create job' });
                }

                const jobId = this.lastID;

                if (finalLocationIds.length > 0) {
                    const placeholders = finalLocationIds.map(() => '(?, ?)').join(',');
                    const values = [];
                    finalLocationIds.forEach(locId => {
                        values.push(jobId, locId);
                    });
                    const jlQuery = `INSERT OR IGNORE INTO job_locations (job_id, location_id) VALUES ${placeholders}`;
                    self.db.run(jlQuery, values, function(jlErr) {
                        if (jlErr) {
                            console.error('Error associating locations:', jlErr);
                        }
                        handleTags();
                    });
                } else {
                    handleTags();
                }

                async function handleTags() {
                    let aiTagsSuccess = false;
                    let manualTagsSuccess = false;
                    
                    // Try to generate AI tags first
                    if (job_description && job_description.trim()) {
                        try {
                            aiTagsSuccess = await self.generateAndAssociateAITags(jobId, job_name, job_description);
                        } catch (error) {
                            console.error('Error generating AI tags:', error);
                            aiTagsSuccess = false;
                        }
                    }
                    
                    // Handle manual tags if provided
                    if (tags.length > 0) {
                        try {
                            await new Promise((resolve, reject) => {
                                self.handleJobTags(jobId, tags, (tagErr) => {
                                    if (tagErr) {
                                        reject(tagErr);
                                    } else {
                                        resolve();
                                    }
                                });
                            });
                            manualTagsSuccess = true;
                        } catch (error) {
                            console.error('Error handling manual tags:', error);
                            manualTagsSuccess = false;
                        }
                    } else {
                        manualTagsSuccess = true; // No manual tags to process
                    }
                    
                    // Update failed_ai_request flag if AI tagging failed
                    if (!aiTagsSuccess && job_description && job_description.trim()) {
                        self.db.run('UPDATE jobs SET failed_ai_request = 1 WHERE entity_id = ?', [jobId], (updateErr) => {
                            if (updateErr) {
                                console.error('Error updating failed_ai_request flag:', updateErr);
                            }
                        });
                    }
                    
                    // Send response
                    const warnings = [];
                    if (!aiTagsSuccess && job_description && job_description.trim()) {
                        warnings.push('AI tag generation failed');
                    }
                    if (!manualTagsSuccess && tags.length > 0) {
                        warnings.push('Manual tag association failed');
                    }
                    
                    if (warnings.length > 0) {
                        res.status(201).json({ 
                            id: jobId, 
                            message: 'Job created with warnings',
                            warnings: warnings
                        });
                    } else {
                        res.status(201).json({ id: jobId, message: 'Job created successfully' });
                    }
                }
            });

        } catch (error) {
            console.error('Error in createJob:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get or create company
     */
    getOrCreateCompany(companyName) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT company_id FROM companies WHERE company_name = ?', [companyName], (err, row) => {
                if (err) return reject(err);
                
                if (row) {
                    resolve(row.company_id);
                } else {
                    this.db.run('INSERT INTO companies (company_name) VALUES (?)', [companyName], function(err) {
                        if (err) return reject(err);
                        resolve(this.lastID);
                    });
                }
            });
        });
    }

    /**
     * Get or create locations
     */
    getOrCreateLocations(location) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT location_id FROM locations WHERE location = ?', [location], (err, row) => {
                if (err) return reject(err);
                
                if (row) {
                    resolve(row.location_id);
                } else {
                    this.db.run('INSERT INTO locations (location) VALUES (?)', [location], function(err) {
                        if (err) return reject(err);
                        resolve(this.lastID);
                    });
                }
            });
        });
    }

    /**
     * Generate and associate AI tags for a job
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

            // Convert AI tags to tag names array for existing handleJobTags method
            const tagNames = aiTags.map(tag => tag.name);
            
            // First, create tags with categories
            const tagIds = await this.createTagsWithCategories(aiTags);
            
            // Then associate them with the job
            await this.associateTagsWithJob(jobId, tagIds);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to generate AI tags:', error);
            return false;
        }
    }

    /**
     * Create tags with categories
     */
    async createTagsWithCategories(aiTags) {
        const tagIds = [];
        
        for (const tag of aiTags) {
            try {
                const tagId = await new Promise((resolve, reject) => {
                    // First try to find existing tag
                    this.db.get('SELECT tag_id FROM tags WHERE tag_name = ?', [tag.name], (err, row) => {
                        if (err) return reject(err);
                        
                        if (row) {
                            resolve(row.tag_id);
                        } else {
                            // Create new tag with category
                            this.db.run('INSERT INTO tags (tag_name, tag_category) VALUES (?, ?)', 
                                [tag.name, tag.category], function(err) {
                                if (err) return reject(err);
                                resolve(this.lastID);
                            });
                        }
                    });
                });
                
                tagIds.push(tagId);
            } catch (error) {
                console.error(`❌ Failed to create tag ${tag.name}:`, error);
            }
        }
        
        return tagIds;
    }

    /**
     * Associate tags with job
     */
    async associateTagsWithJob(jobId, tagIds) {
        for (const tagId of tagIds) {
            try {
                await new Promise((resolve, reject) => {
                    this.db.run(
                        'INSERT OR IGNORE INTO job_tags (job_id, tag_id) VALUES (?, ?)',
                        [jobId, tagId],
                        (err) => {
                            if (err) return reject(err);
                            resolve();
                        }
                    );
                });
            } catch (error) {
                console.error(`❌ Failed to associate tag ${tagId} with job ${jobId}:`, error);
            }
        }
    }

    /**
     * Handle job tags association
     */
    handleJobTags(jobId, tags, callback) {
        const promises = tags.map(tagName => {
            return new Promise((resolve, reject) => {
                this.db.get('SELECT tag_id FROM tags WHERE tag_name = ?', [tagName], (err, row) => {
                    if (err) return reject(err);
                    
                    if (row) {
                        resolve(row.tag_id);
                    } else {
                        this.db.run('INSERT INTO tags (tag_name) VALUES (?)', [tagName], function(err) {
                            if (err) return reject(err);
                            resolve(this.lastID);
                        });
                    }
                });
            });
        });

        Promise.all(promises)
            .then(tagIds => {
                const insertPromises = tagIds.map(tagId => {
                    return new Promise((resolve, reject) => {
                        this.db.run(
                            'INSERT OR IGNORE INTO job_tags (job_id, tag_id) VALUES (?, ?)',
                            [jobId, tagId],
                            (err) => {
                                if (err) return reject(err);
                                resolve();
                            }
                        );
                    });
                });

                return Promise.all(insertPromises);
            })
            .then(() => callback(null))
            .catch(callback);
    }

    /**
     * Update job applied status
     */
    async updateJobApplied(req, res) {
        try {
            const jobId = req.params.id;
            const { applied } = req.body;

            if (typeof applied !== 'boolean') {
                return res.status(400).json({ error: 'Applied field must be boolean' });
            }

            const query = 'UPDATE jobs SET applied = ? WHERE entity_id = ?';
            
            this.db.run(query, [applied ? 1 : 0, jobId], function(err) {
                if (err) {
                    console.error('Error updating job applied status:', err);
                    return res.status(500).json({ error: 'Failed to update job' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Job not found' });
                }

                res.json({ message: 'Job applied status updated successfully' });
            });

        } catch (error) {
            console.error('Error in updateJobApplied:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update job response status
     */
    async updateJobResponse(req, res) {
        try {
            const jobId = req.params.id;
            const { 
                response_status, 
                response_notes, 
                contact_person, 
                contact_email, 
                interview_date, 
                salary_offered, 
                currency 
            } = req.body;

            this.db.get('SELECT response_id FROM jobs WHERE entity_id = ?', [jobId], (err, jobRow) => {
                if (err) {
                    console.error('Error checking job:', err);
                    return res.status(500).json({ error: 'Failed to update response' });
                }

                if (!jobRow) {
                    return res.status(404).json({ error: 'Job not found' });
                }

                if (jobRow.response_id) {
                    const updateQuery = `
                        UPDATE responses SET 
                            response_status = ?, 
                            response_notes = ?, 
                            contact_person = ?, 
                            contact_email = ?, 
                            interview_date = ?, 
                            salary_offered = ?, 
                            currency = ?,
                            response_date = CURRENT_TIMESTAMP
                        WHERE response_id = ?
                    `;

                    this.db.run(updateQuery, [
                        response_status, response_notes, contact_person, 
                        contact_email, interview_date, salary_offered, 
                        currency, jobRow.response_id
                    ], function(err) {
                        if (err) {
                            console.error('Error updating response:', err);
                            return res.status(500).json({ error: 'Failed to update response' });
                        }

                        res.json({ message: 'Response updated successfully' });
                    });

                } else {
                    const insertQuery = `
                        INSERT INTO responses (response_status, response_notes, contact_person, 
                                             contact_email, interview_date, salary_offered, currency)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;

                    const self = this;
                    this.db.run(insertQuery, [
                        response_status, response_notes, contact_person, 
                        contact_email, interview_date, salary_offered, currency
                    ], function(err) {
                        if (err) {
                            console.error('Error creating response:', err);
                            return res.status(500).json({ error: 'Failed to create response' });
                        }

                        const responseId = this.lastID;

                        self.db.run('UPDATE jobs SET response_id = ? WHERE entity_id = ?', 
                            [responseId, jobId], (updateErr) => {
                            if (updateErr) {
                                console.error('Error linking response to job:', updateErr);
                                return res.status(500).json({ error: 'Failed to link response' });
                            }

                            res.json({ message: 'Response created and linked successfully' });
                        });
                    });
                }
            });

        } catch (error) {
            console.error('Error in updateJobResponse:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Delete job
     */
    async deleteJob(req, res) {
        try {
            const jobId = req.params.id;
            const query = 'DELETE FROM jobs WHERE entity_id = ?';
            
            this.db.run(query, [jobId], function(err) {
                if (err) {
                    console.error('Error deleting job:', err);
                    return res.status(500).json({ error: 'Failed to delete job' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Job not found' });
                }

                res.json({ message: 'Job deleted successfully' });
            });

        } catch (error) {
            console.error('Error in deleteJob:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all tags
     */
    async getAllTags(req, res) {
        try {
            const query = 'SELECT * FROM tags ORDER BY tag_name';
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error fetching tags:', err);
                    return res.status(500).json({ error: 'Failed to fetch tags' });
                }

                res.json({ tags: rows });
            });

        } catch (error) {
            console.error('Error in getAllTags:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all websites
     */
    async getAllWebsites(req, res) {
        try {
            const query = 'SELECT * FROM websites WHERE is_active = 1 ORDER BY website_name';
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error fetching websites:', err);
                    return res.status(500).json({ error: 'Failed to fetch websites' });
                }

                res.json({ websites: rows });
            });

        } catch (error) {
            console.error('Error in getAllWebsites:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Create new tag
     */
    async createTag(req, res) {
        try {
            const { tag_name, tag_category } = req.body;

            if (!tag_name) {
                return res.status(400).json({ error: 'tag_name is required' });
            }

            const query = 'INSERT INTO tags (tag_name, tag_category) VALUES (?, ?)';
            
            this.db.run(query, [tag_name, tag_category], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(409).json({ error: 'Tag already exists' });
                    }
                    console.error('Error creating tag:', err);
                    return res.status(500).json({ error: 'Failed to create tag' });
                }

                res.status(201).json({ id: this.lastID, message: 'Tag created successfully' });
            });

        } catch (error) {
            console.error('Error in createTag:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Create new website
     */
    async createWebsite(req, res) {
        try {
            const { website_name, website_url } = req.body;

            if (!website_name || !website_url) {
                return res.status(400).json({ error: 'website_name and website_url are required' });
            }

            const query = 'INSERT INTO websites (website_name, website_url) VALUES (?, ?)';
            
            this.db.run(query, [website_name, website_url], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(409).json({ error: 'Website URL already exists' });
                    }
                    console.error('Error creating website:', err);
                    return res.status(500).json({ error: 'Failed to create website' });
                }

                res.status(201).json({ id: this.lastID, message: 'Website created successfully' });
            });

        } catch (error) {
            console.error('Error in createWebsite:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all companies
     */
    async getAllCompanies(req, res) {
        try {
            const query = 'SELECT * FROM companies ORDER BY company_name';
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error fetching companies:', err);
                    return res.status(500).json({ error: 'Failed to fetch companies' });
                }

                res.json({ companies: rows });
            });

        } catch (error) {
            console.error('Error in getAllCompanies:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all locations
     */
    async getAllLocations(req, res) {
        try {
            const query = 'SELECT * FROM locations ORDER BY location';
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error fetching locations:', err);
                    return res.status(500).json({ error: 'Failed to fetch locations' });
                }

                res.json({ locations: rows });
            });

        } catch (error) {
            console.error('Error in getAllLocations:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Create new company
     */
    async createCompany(req, res) {
        try {
            const { company_name, company_description, company_website, company_size } = req.body;

            if (!company_name) {
                return res.status(400).json({ error: 'company_name is required' });
            }

            const query = 'INSERT INTO companies (company_name, company_description, company_website, company_size) VALUES (?, ?, ?, ?)';
            
            this.db.run(query, [company_name, company_description, company_website, company_size], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(409).json({ error: 'Company already exists' });
                    }
                    console.error('Error creating company:', err);
                    return res.status(500).json({ error: 'Failed to create company' });
                }

                res.status(201).json({ id: this.lastID, message: 'Company created successfully' });
            });

        } catch (error) {
            console.error('Error in createCompany:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Create new location
     */
    async createLocation(req, res) {
        try {
            const { location } = req.body;

            if (!location) {
                return res.status(400).json({ error: 'location is required' });
            }

            const query = 'INSERT INTO locations (location) VALUES (?)';
            
            this.db.run(query, [location], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(409).json({ error: 'Location already exists' });
                    }
                    console.error('Error creating location:', err);
                    return res.status(500).json({ error: 'Failed to create location' });
                }

                res.status(201).json({ id: this.lastID, message: 'Location created successfully' });
            });

        } catch (error) {
            console.error('Error in createLocation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Error handler middleware
     */
    errorHandler(err, req, res, next) {
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }

    /**
     * Start the server
     */
    async start(port = 3000) {
        try {
            await this.connectDB();
            
            this.app.listen(port, () => {
                console.log(`🚀 Job Dashboard API server running on port ${port}`);
                console.log(`📖 API Endpoints:`);
                console.log(`   GET  /api/jobs              - Get all jobs`);
                console.log(`   GET  /api/jobs/search       - Search jobs`);
                console.log(`   GET  /api/jobs/:id          - Get specific job`);
                console.log(`   POST /api/jobs              - Create job`);
                console.log(`   PUT  /api/jobs/:id/applied  - Update applied status`);
                console.log(`   PUT  /api/jobs/:id/response - Update response status`);
                console.log(`   DEL  /api/jobs/:id          - Delete job`);
                console.log(`   POST /api/jobs/check-duplicate - Check for job duplicates`);
                console.log(`   GET  /api/tags              - Get all tags`);
                console.log(`   GET  /api/websites          - Get all websites`);
                console.log(`   GET  /api/companies         - Get all companies`);
                console.log(`   GET  /api/locations         - Get all locations`);
                console.log(`   POST /api/tags              - Create tag`);
                console.log(`   POST /api/websites          - Create website`);
                console.log(`   POST /api/companies         - Create company`);
                console.log(`   POST /api/locations         - Create location`);
            });

        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

module.exports = JobDashboardAPI;

if (require.main === module) {
    const api = new JobDashboardAPI();
    const port = process.env.PORT || 3000;
    api.start(port);
} 