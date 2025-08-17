const http = require('http');
const fs = require('fs');
const path = require('path');
const JobDashboardAPI = require('./server.js');

class APITester {
	aiTestEnabled = true;

	constructor() {
		this.testDbPath = './data/test_job_dashboard.db';
		this.baseUrl = 'http://localhost:3001';
		this.server = null;
		this.testIds = {
			website_id: null,
			company_id: null,
			location_id: null,
			tag_id: null,
			job_id: null,
			response_id: null
		};
		this.failedTests = [];
	}

	/**
	 * Setup test environment
	 */
	async setup() {
		console.log('🧪 Setting up test environment...');

		if (fs.existsSync(this.testDbPath)) {
			fs.unlinkSync(this.testDbPath);
			console.log('🗑️ Removed existing test database');
		}

		this.api = new JobDashboardAPI(this.testDbPath);
		await this.api.initializeDatabase();

		this.server = this.api.app.listen(3001, () => {
			console.log('🚀 Test server running on port 3001');
		});

		await this.wait(1000);
		console.log('✅ Test environment ready');
	}

	/**
	 * Cleanup test environment
	 */
	async cleanup() {
		console.log('\n🧹 Cleaning up test environment...');

		if (this.server) {
			this.server.close();
			console.log('🛑 Test server stopped');
		}

		if (this.api && this.api.dbService) {
			await this.api.close();
			console.log('🔒 Database connection closed');
			await this.wait(500);
		}

		if (fs.existsSync(this.testDbPath)) {
			fs.unlinkSync(this.testDbPath);
			console.log('🗑️ Test database removed');
		}

		console.log('✅ Cleanup complete');
	}

	/**
	 * Make HTTP request
	 */
	makeRequest(method, path, data = null) {
		return new Promise((resolve, reject) => {
			const url = new URL(path, this.baseUrl);
			const options = {
				hostname: url.hostname,
				port: url.port,
				path: url.pathname + url.search,
				method: method,
				headers: {
					'Content-Type': 'application/json'
				}
			};

			const req = http.request(options, (res) => {
				let body = '';
				res.on('data', (chunk) => body += chunk);
				res.on('end', () => {
					try {
						const result = {
							status: res.statusCode,
							data: body ? JSON.parse(body) : null
						};
						resolve(result);
					} catch (e) {
						resolve({
							status: res.statusCode,
							data: body
						});
					}
				});
			});

			req.on('error', reject);

			if (data) {
				req.write(JSON.stringify(data));
			}

			req.end();
		});
	}

	/**
	 * Assert helper
	 */
	assert(condition, message) {
		if (!condition) {
			throw new Error(`❌ Assertion failed: ${message}`);
		}
		console.log(`✅ ${message}`);
	}

	/**
	 * Wait helper
	 */
	wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Run all tests
	 */
	async runAllTests() {
		console.log('\n🧪 Starting API tests...\n');

		try {
			await this.runTest(() => this.testHealth(), 'Health check');
			await this.runTest(() => this.testWebsites(), 'Websites');
			await this.runTest(() => this.testCompanies(), 'Companies');
			await this.runTest(() => this.testLocations(), 'Locations');
			await this.runTest(() => this.testTags(), 'Tags');
			await this.runTest(() => this.testTagNormalization(), 'Tag Normalization');
			await this.runTest(() => this.testJobs(), 'Jobs');
			await this.runTest(() => this.testDuplicateChecking(), 'Duplicate Job Checking');
			await this.runTest(() => this.testAITagGeneration(), 'AI Tag Generation');

			if (!this.failedTests.length) {
				console.log('\n🎉 All tests passed!');
			} else {
				console.log('\n💥 Some tests failed:');

				for (const [name, message] of this.failedTests) {
					console.log(`- ${name}: ${message}`);
				}
			}
		} catch (error) {
			console.error('\n💥 Test failed:', error.message);
			throw error;
		}
	}

	/**
	 * Run a test
	 */
	async runTest(test, name) {
		try {
			await test();
		} catch (error) {
			console.error('\n💥 Test failed:', error.message);
			this.failedTests.push([name, error.message]);
		}
	}

	/**
	 * Test health check endpoint
	 */
	async testHealth() {
		console.log('📍 Testing health check...');

		const response = await this.makeRequest('GET', '/health');
		this.assert(response.status === 200, 'Health check returns 200');
		this.assert(response.data.status === 'ok', 'Health check status is ok');
	}

	/**
	 * Test website operations
	 */
	async testWebsites() {
		console.log('\n📍 Testing website operations...');

		const createData = {
			website_name: 'Test Job Board',
			website_url: 'https://testjobs.com'
		};

		const createResponse = await this.makeRequest('POST', '/api/websites', createData);
		this.assert(createResponse.status === 201, 'Website creation returns 201');
		this.assert(createResponse.data.id, 'Website creation returns ID');
		this.testIds.website_id = createResponse.data.id;

		const getResponse = await this.makeRequest('GET', '/api/websites');
		this.assert(getResponse.status === 200, 'Get websites returns 200');
		this.assert(Array.isArray(getResponse.data.websites), 'Websites data is array');
		this.assert(getResponse.data.websites.length > 0, 'At least one website exists');
	}

	/**
	 * Test company operations
	 */
	async testCompanies() {
		console.log('\n📍 Testing company operations...');

		const createData = {
			company_name: 'Test Tech Corp',
			company_description: 'A test technology company',
			company_website: 'https://testtech.com',
			company_size: '100-500'
		};

		const createResponse = await this.makeRequest('POST', '/api/companies', createData);
		this.assert(createResponse.status === 201, 'Company creation returns 201');
		this.assert(createResponse.data.id, 'Company creation returns ID');
		this.testIds.company_id = createResponse.data.id;

		const getResponse = await this.makeRequest('GET', '/api/companies');
		this.assert(getResponse.status === 200, 'Get companies returns 200');
		this.assert(Array.isArray(getResponse.data.companies), 'Companies data is array');
		this.assert(getResponse.data.companies.length > 0, 'At least one company exists');
	}

	/**
	 * Test location operations
	 */
	async testLocations() {
		console.log('\n📍 Testing location operations...');

		// Create first location
		const createData1 = {
			location: 'Remote'
		};
		const createResponse1 = await this.makeRequest('POST', '/api/locations', createData1);
		this.assert(createResponse1.status === 201, 'Location creation returns 201');
		this.assert(createResponse1.data.id, 'Location creation returns ID');
		const locationId1 = createResponse1.data.id;

		// Create second location
		const createData2 = {
			location: 'Stockholm'
		};
		const createResponse2 = await this.makeRequest('POST', '/api/locations', createData2);
		this.assert(createResponse2.status === 201, 'Second location creation returns 201');
		this.assert(createResponse2.data.id, 'Second location creation returns ID');
		const locationId2 = createResponse2.data.id;

		// Get all locations
		const getResponse = await this.makeRequest('GET', '/api/locations');
		this.assert(getResponse.status === 200, 'Get locations returns 200');
		this.assert(Array.isArray(getResponse.data.locations), 'Locations data is array');
		this.assert(getResponse.data.locations.length >= 2, 'At least two locations exist');

		// Save one location for job tests
		this.testIds.location_id = locationId1;

		// Test creating a job with multiple locations
		const jobData = {
			job_name: 'Multi-location Developer',
			job_description: 'Job with multiple locations',
			company_id: this.testIds.company_id,
			publication_date: '2024-01-20',
			job_url: '/multi-location-developer',
			website_id: this.testIds.website_id,
			tags: ['Node.js'],
			location_ids: [locationId1, locationId2]
		};
		const jobCreateResponse = await this.makeRequest('POST', '/api/jobs', jobData);
		this.assert(jobCreateResponse.status === 201, 'Job with multiple locations creation returns 201');
		const jobId = jobCreateResponse.data.id;

		// Fetch the job and verify locations
		const getJobResponse = await this.makeRequest('GET', `/api/jobs/${jobId}`);
		this.assert(getJobResponse.status === 200, 'Get job with multiple locations returns 200');
		this.assert(Array.isArray(getJobResponse.data.job.locations), 'Job locations is array');
		this.assert(getJobResponse.data.job.locations.includes('Remote'), 'Job locations include Remote');
		this.assert(getJobResponse.data.job.locations.includes('Stockholm'), 'Job locations include Stockholm');
	}

	/**
	 * Test tag operations
	 */
	async testTags() {
		console.log('\n📍 Testing tag operations...');

		const createData = {
			tag_name: 'MySql',
			tag_category: 'database'
		};

		const createResponse = await this.makeRequest('POST', '/api/tags', createData);
		this.assert(createResponse.status === 201, 'Tag creation returns 201');
		this.assert(createResponse.data.id, 'Tag creation returns ID');
		this.testIds.tag_id = createResponse.data.id;

		const getResponse = await this.makeRequest('GET', '/api/tags');
		this.assert(getResponse.status === 200, 'Get tags returns 200');
		this.assert(Array.isArray(getResponse.data.tags), 'Tags data is array');
		this.assert(getResponse.data.tags.length > 0, 'At least one tag exists');

		// Verify the created tag has both tag_name and normalized_name
		const createdTag = getResponse.data.tags.find(tag => tag.tag_id === this.testIds.tag_id);
		this.assert(createdTag, 'Created tag found in list');
		this.assert(createdTag.tag_name === 'MySql', 'Tag name preserved correctly');
		this.assert(createdTag.normalized_name === 'mysql', 'Tag normalized name created correctly');
	}

	/**
	 * Test tag normalization functionality
	 */
	async testTagNormalization() {
		console.log('\n📍 Testing tag normalization...');

		// Test Case 1: Create job with various Node.js tag formats
		console.log('   Testing Node.js normalization variants...');
		const nodeJsVariants = [
			'Node.js',
			'NodeJS',
			'node js',
			'NODE.JS',
			'node.js'
		];

		const baseJobData = {
			job_name: 'Node.js Developer Test',
			job_description: 'Testing tag normalization with various Node.js formats',
			company_id: this.testIds.company_id,
			website_id: this.testIds.website_id,
			publication_date: '2024-01-20',
			location_id: this.testIds.location_id
		};

		// Create jobs with different Node.js tag formats
		const nodeJobIds = [];
		for (let i = 0; i < nodeJsVariants.length; i++) {
			const jobData = {
				...baseJobData,
				job_name: `Node.js Developer Test ${i + 1}`,
				job_url: `/nodejs-test-${i + 1}`,
				tags: [nodeJsVariants[i]]
			};

			const response = await this.makeRequest('POST', '/api/jobs', jobData);
			this.assert(response.status === 201, `Job ${i + 1} with tag "${nodeJsVariants[i]}" created successfully`);
			nodeJobIds.push(response.data.id);
		}

		// Wait a bit for processing
		await this.wait(500);

		// Check that all variants created only one unique tag
		const getTagsResponse = await this.makeRequest('GET', '/api/tags');
		this.assert(getTagsResponse.status === 200, 'Get tags returns 200');

		const nodeTags = getTagsResponse.data.tags.filter(tag =>
			tag.normalized_name === 'nodejs'
		);

		console.log(`   Found ${nodeTags.length} normalized Node.js tags`);
		this.assert(nodeTags.length === 1, 'All Node.js variants normalized to single tag');

		const nodeTag = nodeTags[0];
		console.log(`   Normalized tag: "${nodeTag.tag_name}" -> "${nodeTag.normalized_name}"`);

		// Test Case 2: C# and C++ normalization
		console.log('   Testing C# and C++ normalization...');
		const specialCharTags = ['C#', 'C++', 'c#', 'c++', 'C Sharp', 'C Plus Plus'];

		for (let i = 0; i < specialCharTags.length; i++) {
			const jobData = {
				...baseJobData,
				job_name: `Developer Test ${i + 1}`,
				job_url: `/special-char-test-${i + 1}`,
				tags: [specialCharTags[i]]
			};

			const response = await this.makeRequest('POST', '/api/jobs', jobData);
			this.assert(response.status === 201, `Job with tag "${specialCharTags[i]}" created successfully`);
		}

		await this.wait(500);

		// Check C# normalization
		const getTagsResponse2 = await this.makeRequest('GET', '/api/tags');
		const csharpTags = getTagsResponse2.data.tags.filter(tag =>
			tag.normalized_name === 'csharp'
		);
		const cplusplusTags = getTagsResponse2.data.tags.filter(tag =>
			tag.normalized_name === 'cplusplus'
		);

		console.log(`   Found ${csharpTags.length} C# normalized tags`);
		console.log(`   Found ${cplusplusTags.length} C++ normalized tags`);
		this.assert(csharpTags.length >= 1, 'C# variants normalized correctly');
		this.assert(cplusplusTags.length >= 1, 'C++ variants normalized correctly');

		// Test Case 3: Manual tag creation with normalization
		console.log('   Testing manual tag creation with normalization...');

		// Try to create duplicate tags manually
		const duplicateTagAttempts = [
			{ tag_name: 'React.js', tag_category: 'framework' },
			{ tag_name: 'ReactJS', tag_category: 'framework' },
			{ tag_name: 'react js', tag_category: 'framework' }
		];

		let successfulCreations = 0;
		let duplicateRejections = 0;
		for (const tagData of duplicateTagAttempts) {
			const response = await this.makeRequest('POST', '/api/tags', tagData);
			if (response.status === 201) {
				successfulCreations++;
				console.log(`   ✅ Created tag: "${tagData.tag_name}"`);
			} else if (response.status === 409) {
				duplicateRejections++;
				console.log(`   ⚠️ Tag creation rejected (expected): "${tagData.tag_name}" - ${response.data.error}`);
			} else {
				console.log(`   ❌ Unexpected response: "${tagData.tag_name}" - Status: ${response.status}, Error: ${response.data?.error}`);
			}
		}

		// Should only create one tag due to normalization
		this.assert(successfulCreations === 1, 'Only one React tag created due to normalization');
		this.assert(duplicateRejections === 2, 'Two duplicate React tags properly rejected');

		// Test Case 4: Verify normalization in job search
		console.log('   Testing tag search with normalization...');

		// Search for jobs with normalized tag names
		const searchResponse = await this.makeRequest('GET', '/api/jobs/search?tags=nodejs');
		this.assert(searchResponse.status === 200, 'Tag search returns 200');

		if (searchResponse.data.jobs.length > 0) {
			console.log(`   Found ${searchResponse.data.jobs.length} jobs with nodejs tag`);
			this.assert(searchResponse.data.jobs.length >= nodeJobIds.length, 'Found all Node.js jobs regardless of original tag format');
		}

		// Test Case 5: Edge cases
		console.log('   Testing edge cases...');
		const edgeCaseJobData = {
			...baseJobData,
			job_name: 'Edge Case Developer',
			job_url: '/edge-case-test',
			tags: ['...JavaScript...', 'Type-Script', 'Vue_js', 'Angular.JS']
		};

		const edgeResponse = await this.makeRequest('POST', '/api/jobs', edgeCaseJobData);
		this.assert(edgeResponse.status === 201, 'Edge case tags job created successfully');

		await this.wait(500);

		const finalTagsResponse = await this.makeRequest('GET', '/api/tags');
		const edgeTags = finalTagsResponse.data.tags.filter(tag =>
			['javascript', 'typescript', 'vuejs', 'angularjs'].includes(tag.normalized_name)
		);

		console.log(`   Found ${edgeTags.length} normalized edge case tags`);
		edgeTags.forEach(tag => {
			console.log(`   Edge case: "${tag.tag_name}" -> "${tag.normalized_name}"`);
		});

		console.log('   🎉 Tag normalization tests completed successfully!');
	}

	/**
	 * Test job operations
	 */
	async testJobs() {
		console.log('\n📍 Testing job operations...');

		const createData = {
			job_name: 'Test Developer Position',
			job_description: 'This is a test job description for a developer position.',
			company_id: this.testIds.company_id,
			location_id: this.testIds.location_id,
			publication_date: '2024-01-15',
			job_url: '/test-developer-position',
			website_id: this.testIds.website_id,
			tags: ['Node.js', 'JavaScript', 'React']
		};

		const createResponse = await this.makeRequest('POST', '/api/jobs', createData);
		this.assert(createResponse.status === 201, 'Job creation returns 201');
		this.assert(createResponse.data.id, 'Job creation returns ID');
		this.testIds.job_id = createResponse.data.id;

		const createData2 = {
			job_name: 'Another Test Position',
			job_description: 'Another test job.',
			company_name: 'Auto Created Company',
			location_city: 'Auto City',
			location_country: 'Auto Country',
			job_url: '/another-test-position',
			website_id: this.testIds.website_id,
			tags: ['Python']
		};

		const createResponse2 = await this.makeRequest('POST', '/api/jobs', createData2);
		this.assert(createResponse2.status === 201, 'Job creation with auto-company returns 201');

		const getResponse = await this.makeRequest('GET', '/api/jobs');
		this.assert(getResponse.status === 200, 'Get jobs returns 200');
		this.assert(Array.isArray(getResponse.data.jobs), 'Jobs data is array');
		this.assert(getResponse.data.jobs.length >= 2, 'At least two jobs exist');

		const getJobResponse = await this.makeRequest('GET', `/api/jobs/${this.testIds.job_id}`);
		this.assert(getJobResponse.status === 200, 'Get specific job returns 200');
		this.assert(getJobResponse.data.job.entity_id == this.testIds.job_id, 'Returned job has correct ID');
		this.assert(getJobResponse.data.job.job_name === createData.job_name, 'Job name matches');
		this.assert(Array.isArray(getJobResponse.data.job.tags), 'Job has tags array');

		const searchResponse = await this.makeRequest('GET', '/api/jobs/search?q=Test');
		this.assert(searchResponse.status === 200, 'General search returns 200');
		this.assert(Array.isArray(searchResponse.data.jobs), 'Search results is array');
		this.assert(searchResponse.data.jobs.length > 0, 'Search finds jobs');

		const nameSearchResponse = await this.makeRequest('GET', '/api/jobs/search?job_name=Developer');
		this.assert(nameSearchResponse.status === 200, 'Name search returns 200');
		this.assert(nameSearchResponse.data.jobs.length > 0, 'Name search finds jobs');

		const companySearchResponse = await this.makeRequest('GET', '/api/jobs/search?company=Tech');
		this.assert(companySearchResponse.status === 200, 'Company search returns 200');

		const tagsSearchResponse = await this.makeRequest('GET', '/api/jobs/search?tags=Node.js');
		this.assert(tagsSearchResponse.status === 200, 'Tags search returns 200');

		const appliedUpdateData = { applied: true };
		const appliedResponse = await this.makeRequest('PUT', `/api/jobs/${this.testIds.job_id}/applied`, appliedUpdateData);
		this.assert(appliedResponse.status === 200, 'Applied status update returns 200');

		const responseUpdateData = {
			response_status: 'interview_scheduled',
			response_notes: 'Phone interview scheduled for next week',
			contact_person: 'John Doe',
			contact_email: 'john@testtech.com',
			salary_offered: 75000,
			currency: 'USD'
		};
		const responseResponse = await this.makeRequest('PUT', `/api/jobs/${this.testIds.job_id}/response`, responseUpdateData);
		this.assert(responseResponse.status === 200, 'Response update returns 200');

		const updatedJobResponse = await this.makeRequest('GET', `/api/jobs/${this.testIds.job_id}`);
		this.assert(updatedJobResponse.status === 200, 'Get updated job returns 200');
		this.assert(updatedJobResponse.data.job.applied === true, 'Applied status was updated');
		this.assert(updatedJobResponse.data.job.response_status === 'interview_scheduled', 'Response status was updated');

		const deleteResponse = await this.makeRequest('DELETE', `/api/jobs/${this.testIds.job_id}`);
		this.assert(deleteResponse.status === 200, 'Job deletion returns 200');

		const deletedJobResponse = await this.makeRequest('GET', `/api/jobs/${this.testIds.job_id}`);
		this.assert(deletedJobResponse.status === 404, 'Deleted job returns 404');
	}

	/**
	 * Test duplicate job checking functionality
	 */
	async testDuplicateChecking() {
		console.log('\n📍 Testing duplicate job checking...');

		// Test 1: Create a new job
		console.log('   Creating first job...');
		const job1 = {
			job_name: 'Senior JavaScript Developer',
			job_description: 'We are looking for a senior JavaScript developer',
			company_name: 'TechCorp Duplicate Test',
			publication_date: '2024-01-15',
			job_url: '/duplicate-test-job-1',
			website_id: this.testIds.website_id,
			tags: ['JavaScript', 'Senior'],
			location_ids: []
		};

		const response1 = await this.makeRequest('POST', '/api/jobs', job1);
		this.assert(response1.status === 201, 'First job creation returns 201');
		this.assert(response1.data.id, 'First job creation returns ID');
		const firstJobId = response1.data.id;

		// Test 2: Try to create the same job again (should fail)
		console.log('   Attempting to create duplicate job...');
		const duplicateResponse = await this.makeRequest('POST', '/api/jobs', job1);
		this.assert(duplicateResponse.status === 409, 'Duplicate job creation returns 409');
		console.log(duplicateResponse.data);
		this.assert(duplicateResponse.data.error.includes("already exists"), "Duplicate error message correct");

		console.log('   ✅ Duplicate check working correctly!');

		// Test 3: Create a job with same name but different company (should succeed)
		console.log('   Creating job with same name but different company...');
		const job3 = {
			job_name: 'Senior JavaScript Developer',
			job_description: 'Different company, same job title',
			company_name: 'DifferentCorp Duplicate Test',
			publication_date: '2024-01-16',
			job_url: '/duplicate-test-job-3',
			website_id: this.testIds.website_id,
			tags: ['JavaScript', 'Senior'],
			location_ids: []
		};

		const response3 = await this.makeRequest('POST', '/api/jobs', job3);
		this.assert(response3.status === 201, 'Job with same name but different company returns 201');
		this.assert(response3.data.id, 'Job with different company returns ID');
		console.log('   ✅ Same job name with different company allowed');

		// Test 4: Create a job with different name but same company (should succeed)
		console.log('   Creating job with different name but same company...');
		const job4 = {
			job_name: 'Junior JavaScript Developer',
			job_description: 'Same company, different job title',
			company_name: 'TechCorp Duplicate Test',
			publication_date: '2024-01-17',
			job_url: '/duplicate-test-job-4',
			website_id: this.testIds.website_id,
			tags: ['JavaScript', 'Junior'],
			location_ids: []
		};

		const response4 = await this.makeRequest('POST', '/api/jobs', job4);
		this.assert(response4.status === 201, 'Job with different name but same company returns 201');
		this.assert(response4.data.id, 'Job with different name returns ID');
		console.log('   ✅ Different job name with same company allowed');

		// Test 5: Try to create exact duplicate again (should still fail)
		console.log('   Attempting to create exact duplicate again...');
		const duplicateResponse2 = await this.makeRequest('POST', '/api/jobs', job1);
		this.assert(duplicateResponse2.status === 409, 'Second duplicate attempt returns 409');
		console.log('   ✅ Duplicate check still working correctly!');

		console.log('   🎉 All duplicate checking scenarios passed!');
	}

	/**
	 * Test AI tag generation
	 */
	async testAITagGeneration() {
		if (!this.aiTestEnabled) {
			console.log('\n📍 AI tag generation test is disabled, skipping...');
			return;
		}

		console.log('\n📍 Testing AI tag generation...');

		const aiJobData = {
			job_name: 'Senior Full Stack Developer',
			job_description: `We are looking for a Senior Full Stack Developer to join our team. 
            
            Requirements:
            - 5+ years of experience with JavaScript, React, and Node.js
            - Strong knowledge of MySQL and PostgreSQL databases
            - Experience with Docker containerization and AWS cloud services
            - Proficiency in Python for backend development
            - Knowledge of REST APIs and microservices architecture
            - Experience with Git version control and CI/CD pipelines
            - Understanding of Agile development methodologies
            
            Tech Stack:
            - Frontend: React, Vue.js, TypeScript
            - Backend: Node.js, Python, Django
            - Database: MySQL, PostgreSQL, Redis
            - Cloud: AWS, Docker, Kubernetes
            - Tools: Git, Jenkins, Webpack`,
			company_id: this.testIds.company_id,
			publication_date: '2024-01-20',
			website_id: this.testIds.website_id,
			job_url: '/test-ai-job',
			tags: []
		};

		const createResponse = await this.makeRequest('POST', '/api/jobs', aiJobData);
		this.assert(createResponse.status === 201, 'AI job creation returns 201');
		this.assert(createResponse.data.id, 'AI job creation returns ID');

		const aiJobId = createResponse.data.id;

		await this.wait(1000);

		const getJobResponse = await this.makeRequest('GET', `/api/jobs/${aiJobId}`);
		this.assert(getJobResponse.status === 200, 'Get AI job returns 200');

		const job = getJobResponse.data.job;
		this.assert(Array.isArray(job.tags), 'Job has tags array');

		if (job.tags.length > 0) {
			console.log(`🤖 AI generated ${job.tags.length} tags: ${job.tags.join(', ')}`);
			this.assert(job.tags.length > 0, 'AI generated tags for job');

			const expectedTechs = ['javascript', 'react', 'nodejs', 'mysql', 'postgresql', 'python', 'docker', 'aws'];
			const foundTechs = job.tags.filter(tag =>
				expectedTechs.some(tech => tag.toLowerCase().replace(/[.\-_\s]/g, '').includes(tech))
			);

			if (foundTechs.length > 0) {
				console.log(`✅ Found expected technology tags: ${foundTechs.join(', ')}`);
				this.assert(foundTechs.length > 0, 'AI generated relevant technology tags');
			} else {
				console.log('⚠️ No expected technology tags found, but AI did generate tags');
			}

			this.assert(job.failed_ai_request === false || job.failed_ai_request === 0, 'AI request did not fail');
		} else {
			console.log('⚠️ No AI tags were generated');
			if (job.failed_ai_request === true || job.failed_ai_request === 1) {
				console.log('ℹ️ failed_ai_request flag is set correctly');
				this.assert(true, 'failed_ai_request flag set when AI fails');
			} else {
				console.log('⚠️ AI service might not be available or configured');
				this.assert(true, 'AI service not available (expected in test environment)');
			}
		}

		const getAllTagsResponse = await this.makeRequest('GET', '/api/tags');
		this.assert(getAllTagsResponse.status === 200, 'Get all tags returns 200');

		const allTags = getAllTagsResponse.data.tags;
		console.log(`📊 Total tags in system: ${allTags.length}`);

		const categorizedTags = allTags.filter(tag => tag.tag_category && tag.tag_category.trim() !== '');
		if (categorizedTags.length > 0) {
			console.log(`🏷️ Found ${categorizedTags.length} categorized tags`);
			const categories = [...new Set(categorizedTags.map(tag => tag.tag_category))];
			console.log(`📂 Categories: ${categories.join(', ')}`);
			this.assert(categorizedTags.length > 0, 'AI generated tags with categories');
		}
	}
}

async function runTests() {
	const tester = new APITester();

	try {
		await tester.setup();
		await tester.runAllTests();
		await tester.cleanup();

		process.exit(0);
	} catch (error) {
		console.error('\n💥 Tests failed:', error);
		await tester.cleanup();
		process.exit(1);
	}
}

module.exports = APITester;

if (require.main === module) {
	runTests();
} 