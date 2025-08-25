require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Services
const DatabaseService = require('./services/DatabaseService');
const JobService = require('./services/JobService');
const DataService = require('./services/DataService');
const AuthService = require('./services/AuthService');
const UserJobService = require('./services/UserJobService');
const AIService = require('./ai-service');
const DatabaseInitializer = require('./init');

// Repositories
const JobRepository = require('./repositories/JobRepository');
const CompanyRepository = require('./repositories/CompanyRepository');
const TagRepository = require('./repositories/TagRepository');
const LocationRepository = require('./repositories/LocationRepository');
const WebsiteRepository = require('./repositories/WebsiteRepository');
const ResponseRepository = require('./repositories/ResponseRepository');
const UserRepository = require('./repositories/UserRepository');
const UserJobRepository = require('./repositories/UserJobRepository');

// Middleware
const { errorHandler, asyncHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticateToken, authMiddleware } = require('./middleware/auth');
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

		// Serve static files from React build in production
		if (process.env.NODE_ENV === 'production') {
			const frontendPath = path.join(__dirname, '../../dashboard-fe/dist');
			this.app.use(express.static(frontendPath));
			console.log(`📁 Serving frontend from: ${frontendPath}`);
		}
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
		this.repositories.userRepo = new UserRepository(this.dbService);
		this.repositories.userJobRepo = new UserJobRepository(this.dbService);

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
		this.services.authService = new AuthService(this.repositories.userRepo);
		this.services.userJobService = new UserJobService(this.repositories.userJobRepo, this.repositories.jobRepo);

		// Make authService available to middleware
		this.app.locals.authService = this.services.authService;
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
		this.app.get('/api/jobs/analytics', asyncHandler(this.getJobsForAnalytics.bind(this)));
		this.app.get('/api/jobs/:id', asyncHandler(this.getJobById.bind(this)));
		this.app.post('/api/jobs', authMiddleware, validateJobCreation, asyncHandler(this.createJob.bind(this)));
		this.app.put('/api/jobs/:id/applied', authMiddleware, validateAppliedUpdate, asyncHandler(this.updateJobApplied.bind(this)));
		this.app.put('/api/jobs/:id/response', authMiddleware, asyncHandler(this.updateJobResponse.bind(this)));
		this.app.delete('/api/jobs/:id', authMiddleware, asyncHandler(this.deleteJob.bind(this)));
		this.app.post('/api/jobs/check-duplicate', authMiddleware, validateDuplicateCheck, asyncHandler(this.checkDuplicateJob.bind(this)));

		// Data routes
		this.app.get('/api/tags', asyncHandler(this.getAllTags.bind(this)));
		this.app.get('/api/companies', asyncHandler(this.getAllCompanies.bind(this)));
		this.app.get('/api/locations', asyncHandler(this.getAllLocations.bind(this)));
		this.app.get('/api/websites', asyncHandler(this.getAllWebsites.bind(this)));

		this.app.post('/api/tags', authMiddleware, validateTagCreation, asyncHandler(this.createTag.bind(this)));
		this.app.post('/api/companies', authMiddleware, validateCompanyCreation, asyncHandler(this.createCompany.bind(this)));
		this.app.post('/api/locations', authMiddleware, validateLocationCreation, asyncHandler(this.createLocation.bind(this)));
		this.app.post('/api/websites', authMiddleware, validateWebsiteCreation, asyncHandler(this.createWebsite.bind(this)));

		// Authentication routes
		this.app.post('/api/auth/register', asyncHandler(this.register.bind(this)));
		this.app.post('/api/auth/login', asyncHandler(this.login.bind(this)));
		this.app.post('/api/auth/logout', asyncHandler(this.logout.bind(this)));

		// User job routes (protected)
		this.app.get('/api/users/:userId/jobs', authenticateToken, asyncHandler(this.getUserJobs.bind(this)));
		this.app.post('/api/users/:userId/jobs', authenticateToken, asyncHandler(this.createUserJob.bind(this)));
		this.app.put('/api/users/:userId/jobs/:userJobId', authenticateToken, asyncHandler(this.updateUserJob.bind(this)));

		// Error handling
		this.app.use(notFoundHandler);
		this.app.use(errorHandler);

		// Catch all handler for SPA routing (must be after error handlers)
		if (process.env.NODE_ENV === 'production') {
			this.app.get('/{*any}', (req, res) => {
				const indexPath = path.join(__dirname, '../../dashboard-fe/dist/index.html');
				res.sendFile(indexPath);
			});
		}
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

			await this.dbService.init();
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
		console.log('Starting duplicate check...')
		const result = await this.services.jobService.checkDuplicateJob(job_name, company_name);
		console.log('Ending duplicate check')
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
		try {
			// Extract pagination parameters
			const { page, limit, sort, order, ...filters } = req.query;

			const pagination = {
				page: parseInt(page) || 1,
				limit: Math.min(parseInt(limit) || 21, 100), // Max 100 items per page
				sort: sort || 'created_at',
				order: order === 'asc' ? 'asc' : 'desc'
			};

			// Validate pagination parameters
			if (pagination.page < 1) pagination.page = 1;
			if (pagination.limit < 1) pagination.limit = 21;

			// Get paginated jobs for display
			const result = await this.services.jobService.searchJobs(filters, pagination);

			// Get filter options from all jobs (without pagination)
			let allJobs;
			let filterOptions;

			try {
				allJobs = await this.services.jobService.getJobsForFilterOptions(filters);
				filterOptions = this.services.jobService.calculateFilterOptions(allJobs);
			} catch (error) {
				console.error('Error calculating filter options:', error);
				filterOptions = {
					companies: [],
					locations: [],
					tagCategories: {},
					websites: []
				};
			}

			// Create the response with proper structure
			const response = {
				jobs: result.jobs,
				count: result.count,
				pagination: result.pagination,
				query: result.query,
				filters: filterOptions
			};

			res.json(response);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	/**
	 * Get all jobs for analytics (without pagination)
	 */
	async getJobsForAnalytics(req, res) {
		try {
			const { ...filters } = req.query;

			// Get all jobs without pagination for analytics
			const allJobs = await this.services.jobService.getJobsForFilterOptions(filters);

			res.json({
				jobs: allJobs,
				count: allJobs.length
			});
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
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

	// ===== AUTHENTICATION HANDLERS =====

	/**
	 * Register new user
	 */
	async register(req, res) {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				success: false,
				error: 'Email and password are required'
			});
		}

		const result = await this.services.authService.register(email, password);
		res.status(201).json(result);
	}

	/**
	 * Login user
	 */
	async login(req, res) {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				success: false,
				error: 'Email and password are required'
			});
		}

		const result = await this.services.authService.login(email, password);
		res.json(result);
	}

	/**
	 * Logout user (placeholder - JWT is stateless)
	 */
	async logout(req, res) {
		res.json({
			success: true,
			message: 'Logged out successfully'
		});
	}

	// ===== USER JOB HANDLERS =====

	/**
	 * Get all jobs for user
	 */
	async getUserJobs(req, res) {
		const userId = parseInt(req.params.userId);

		// Ensure user can only access their own jobs
		if (req.user.userId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Unauthorized'
			});
		}

		const result = await this.services.userJobService.getUserJobs(userId);
		res.json(result);
	}

	/**
	 * Create user job (save/apply to job)
	 */
	async createUserJob(req, res) {
		const userId = parseInt(req.params.userId);
		const { job_id, status = 'saved', notes } = req.body;

		// Ensure user can only manage their own jobs
		if (req.user.userId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Unauthorized'
			});
		}

		if (!job_id) {
			return res.status(400).json({
				success: false,
				error: 'job_id is required'
			});
		}

		const result = await this.services.userJobService.createUserJob(userId, job_id, status, notes);
		res.status(201).json(result);
	}

	/**
	 * Update user job
	 */
	async updateUserJob(req, res) {
		const userId = parseInt(req.params.userId);
		const userJobId = parseInt(req.params.userJobId);

		// Ensure user can only manage their own jobs
		if (req.user.userId !== userId) {
			return res.status(403).json({
				success: false,
				error: 'Unauthorized'
			});
		}

		const result = await this.services.userJobService.updateUserJob(userId, userJobId, req.body);
		res.json(result);
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
				console.log(`   POST /api/auth/register     - User registration`);
				console.log(`   POST /api/auth/login        - User login`);
				console.log(`   POST /api/auth/logout       - User logout`);
				console.log(`   GET  /api/users/:id/jobs    - Get user jobs (protected)`);
				console.log(`   POST /api/users/:id/jobs    - Add job to user (protected)`);
				console.log(`   PUT  /api/users/:id/jobs/:jobId - Update user job (protected)`);
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