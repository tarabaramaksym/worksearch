const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Services
const DatabaseService = require('./services/DatabaseService');
const JobService = require('./services/JobService');
const DataService = require('./services/DataService');
const AIService = require('./ai-service');
const DatabaseInitializer = require('./init');

// Repositories
const JobRepository = require('./repositories/JobRepository');
const CompanyRepository = require('./repositories/CompanyRepository');
const TagRepository = require('./repositories/TagRepository');
const LocationRepository = require('./repositories/LocationRepository');
const WebsiteRepository = require('./repositories/WebsiteRepository');
const ResponseRepository = require('./repositories/ResponseRepository');

// Middleware
const { errorHandler, asyncHandler, notFoundHandler } = require('./middleware/errorHandler');
const {
    validateJobCreation,
    validateDuplicateCheck,
    validateAppliedUpdate,
    validateTagCreation,
    validateCompanyCreation,
    validateLocationCreation,
    validateWebsiteCreation
} = require('./middleware/validation');

class JobDashboardAPI {
    constructor(dbPath = './data/job_dashboard.db') {
        this.app = express();
        this.dbPath = dbPath;
        this.dbService = new DatabaseService(dbPath);
        this.repositories = {};
        this.services = {};
        
        this.setupMiddleware();
        this.setupServices();
        this.setupRoutes();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup services and repositories
     */
    setupServices() {
        // Initialize repositories
        this.repositories.jobRepo = new JobRepository(this.dbService);
        this.repositories.companyRepo = new CompanyRepository(this.dbService);
        this.repositories.tagRepo = new TagRepository(this.dbService);
        this.repositories.locationRepo = new LocationRepository(this.dbService);
        this.repositories.websiteRepo = new WebsiteRepository(this.dbService);
        this.repositories.responseRepo = new ResponseRepository(this.dbService);

        // Initialize AI service
        const apiKey = process.env.OPENAI_API_KEY;
        const aiService = apiKey ? new AIService(apiKey) : null;
        
        if (aiService) {
            console.log('🤖 AI service initialized');
        } else {
            console.log('⚠️ No OpenAI API key provided, AI features disabled');
        }

        // Initialize business services
        this.services.jobService = new JobService(this.repositories, aiService);
        this.services.dataService = new DataService(this.repositories);
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Job routes
        this.app.get('/api/jobs', asyncHandler(this.getAllJobs.bind(this)));
        this.app.get('/api/jobs/search', asyncHandler(this.searchJobs.bind(this)));
        this.app.get('/api/jobs/filtered', asyncHandler(this.getJobsWithFilters.bind(this)));
        this.app.get('/api/jobs/:id', asyncHandler(this.getJobById.bind(this)));
        this.app.post('/api/jobs', validateJobCreation, asyncHandler(this.createJob.bind(this)));
        this.app.put('/api/jobs/:id/applied', validateAppliedUpdate, asyncHandler(this.updateJobApplied.bind(this)));
        this.app.put('/api/jobs/:id/response', asyncHandler(this.updateJobResponse.bind(this)));
        this.app.delete('/api/jobs/:id', asyncHandler(this.deleteJob.bind(this)));
        this.app.post('/api/jobs/check-duplicate', validateDuplicateCheck, asyncHandler(this.checkDuplicateJob.bind(this)));

        // Data routes
        this.app.get('/api/tags', asyncHandler(this.getAllTags.bind(this)));
        this.app.get('/api/companies', asyncHandler(this.getAllCompanies.bind(this)));
        this.app.get('/api/locations', asyncHandler(this.getAllLocations.bind(this)));
        this.app.get('/api/websites', asyncHandler(this.getAllWebsites.bind(this)));
        
        this.app.post('/api/tags', validateTagCreation, asyncHandler(this.createTag.bind(this)));
        this.app.post('/api/companies', validateCompanyCreation, asyncHandler(this.createCompany.bind(this)));
        this.app.post('/api/locations', validateLocationCreation, asyncHandler(this.createLocation.bind(this)));
        this.app.post('/api/websites', validateWebsiteCreation, asyncHandler(this.createWebsite.bind(this)));

        // Error handling
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);
    }

    /**
     * Initialize database
     */
    async initializeDatabase() {
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

            await this.dbService.connect();
            console.log('🔗 Database service connected');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    // ===== ROUTE HANDLERS =====

    /**
     * Get all jobs
     */
    async getAllJobs(req, res) {
        const result = await this.services.jobService.getAllJobs();
        res.json(result);
    }

    /**
     * Get job by ID
     */
    async getJobById(req, res) {
        const result = await this.services.jobService.getJobById(req.params.id);
        res.json(result);
    }

    /**
     * Search jobs
     */
    async searchJobs(req, res) {
        const result = await this.services.jobService.searchJobs(req.query);
        res.json(result);
    }

    /**
     * Check for duplicate job
     */
    async checkDuplicateJob(req, res) {
        const { job_name, company_name } = req.body;
        const result = await this.services.jobService.checkDuplicateJob(job_name, company_name);
        res.json(result);
    }

    /**
     * Create new job
     */
    async createJob(req, res) {
        const result = await this.services.jobService.createJob(req.body);
        res.status(201).json(result);
    }

    /**
     * Update job applied status
     */
    async updateJobApplied(req, res) {
        const result = await this.services.jobService.updateJobApplied(req.params.id, req.body.applied);
        res.json(result);
    }

    /**
     * Update job response
     */
    async updateJobResponse(req, res) {
        const result = await this.services.jobService.updateJobResponse(req.params.id, req.body);
        res.json(result);
    }

    /**
     * Delete job
     */
    async deleteJob(req, res) {
        const result = await this.services.jobService.deleteJob(req.params.id);
        res.json(result);
    }

    /**
     * Get jobs with filters and dynamic filter options
     */
    async getJobsWithFilters(req, res) {
        const result = await this.services.jobService.getJobsWithFilters(req.query);
        res.json(result);
    }

    /**
     * Get all tags
     */
    async getAllTags(req, res) {
        const result = await this.services.dataService.getAllTags();
        res.json(result);
    }

    /**
     * Create tag
     */
    async createTag(req, res) {
        const result = await this.services.dataService.createTag(req.body);
        res.status(201).json(result);
    }

    /**
     * Get all companies
     */
    async getAllCompanies(req, res) {
        const result = await this.services.dataService.getAllCompanies();
        res.json(result);
    }

    /**
     * Create company
     */
    async createCompany(req, res) {
        const result = await this.services.dataService.createCompany(req.body);
        res.status(201).json(result);
    }

    /**
     * Get all locations
     */
    async getAllLocations(req, res) {
        const result = await this.services.dataService.getAllLocations();
        res.json(result);
    }

    /**
     * Create location
     */
    async createLocation(req, res) {
        const result = await this.services.dataService.createLocation(req.body);
        res.status(201).json(result);
    }

    /**
     * Get all websites
     */
    async getAllWebsites(req, res) {
        const result = await this.services.dataService.getAllWebsites();
        res.json(result);
    }

    /**
     * Create website
     */
    async createWebsite(req, res) {
        const result = await this.services.dataService.createWebsite(req.body);
        res.status(201).json(result);
    }

    /**
     * Start the server
     */
    async start(port = 3000) {
        try {
            await this.initializeDatabase();
            
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
                console.log(`✨ Refactored architecture with clean separation of concerns`);
            });

        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Close database connection
     */
    async close() {
        await this.dbService.close();
    }
}

module.exports = JobDashboardAPI;

// Start server if this file is run directly
if (require.main === module) {
    const api = new JobDashboardAPI();
    const port = process.env.PORT || 3000;
    api.start(port);
} 