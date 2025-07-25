const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function checkJobDuplicate(jobName, companyName, jobUrl, baseApiUrl = 'http://localhost:3000') {
    try {
        const response = await axios.post(`${baseApiUrl}/api/jobs/check-duplicate`, {
            job_name: jobName,
            company_name: companyName,
            job_url: jobUrl
        });
        
        return response.data.isDuplicate;
    } catch (error) {
        console.error(`❌ Error checking duplicate for "${jobName}" at "${companyName}":`, error.response?.data?.error || error.message);
        return false; // Assume not duplicate if check fails
    }
}

const websitesData = getWebsitesData();

function getWebsitesData() {
	const websitesData = {};
	const websites = fs.readdirSync(path.join(__dirname, 'schema'));

	for (const website of websites) {
		if (website === 'dou.json') {
			continue;
		}

		const websiteData = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema', website), 'utf8'));
	
		websitesData[website.replace('.json', '')] = websiteData;
	}

	return websitesData;
}


async function closePopups(page, websiteData) {
	const { popupCloseSelectors } = websiteData;
	
	if (!popupCloseSelectors || !Array.isArray(popupCloseSelectors)) {
		return; // No popup selectors defined
	}

	for (const selector of popupCloseSelectors) {
		try {
			// Check if element exists and is visible
			const popup = await page.locator(selector).first();
			const isVisible = await popup.isVisible({ timeout: 1000 });
			
			if (isVisible) {
				console.log(`🔴 Closing popup: ${selector}`);
				await popup.click();
				await page.waitForTimeout(500); // Wait after clicking
			}
		} catch (error) {
			// Element not found or not clickable - continue to next selector
			console.log(`ℹ️ Popup selector not found: ${selector}`);
		}
	}
}

async function crawlWebsite(websiteData) {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 300,
        executablePath: process.env.BROWSER_PATH,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--no-first-run',
            '--disable-default-apps'
        ]
    });
    
    // Set realistic user agent and browser context with stealth features
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York coordinates
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    // Add minimal stealth scripts to every page
    await context.addInitScript(() => {
        // Remove webdriver property (main automation indicator)
        if ('webdriver' in navigator) {
            delete navigator.webdriver;
        }
        
        // Only override if chrome object doesn't exist (avoid breaking existing functionality)
        if (!window.chrome) {
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
        }
        
        // Minimal screen properties (only if missing)
        if (!screen.availTop) Object.defineProperty(screen, 'availTop', { get: () => 0 });
        if (!screen.availLeft) Object.defineProperty(screen, 'availLeft', { get: () => 0 });
        if (!screen.colorDepth) Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        if (!screen.pixelDepth) Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    });
    
    const { name, baseUrl, urls, loadMoreSelector, loadMoreBtnDisplayNone, scrollToButton, listSelector, listingLink } = websiteData;
    console.log(`🕷️ Starting to crawl ${name}...`);
    
    const allJobUrls = [];
    
    for (const urlPath of urls) {
        const fullUrl = baseUrl + urlPath;
        console.log(`📖 Opening: ${fullUrl}`);
        
        const page = await context.newPage();
        
        await page.goto(fullUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Add human-like behavior after page load
        await page.waitForTimeout(1000 + Math.random() * 2000); // Random delay 1-3 seconds
        
        // Simulate mouse movement (helps avoid detection)
        await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
        await page.waitForTimeout(500 + Math.random() * 1000);
        
        try {
            await page.waitForSelector(listSelector, { timeout: 10000 });
            console.log(`✅ Job list loaded for ${urlPath}`);
        } catch (error) {
            console.log(`⚠️ Job list selector not found, continuing anyway...`);
        }
        
        await page.waitForTimeout(1000 + Math.random() * 1000);
        
		await closePopups(page, websiteData);
		
        let loadMoreClicks = 0;
        const maxClicks = 50;
        
        while (loadMoreClicks < maxClicks) {
            try {
                const loadMoreButton = await page.locator(loadMoreSelector).first();
                const isVisible = await loadMoreButton.isVisible().catch(() => false);

                if (!isVisible) {
                    console.log(`✅ Load more button no longer visible after ${loadMoreClicks} clicks`);
                    break;
                }
                
                if (loadMoreBtnDisplayNone) {
                    const displayStyle = await loadMoreButton.evaluate(el => window.getComputedStyle(el).display);
                    if (displayStyle === 'none') {
                        console.log(`✅ Load more button has display:none after ${loadMoreClicks} clicks`);
                        break;
                    }
                }
                
                console.log(`🔄 Clicking load more button (click #${loadMoreClicks + 1})...`);
                
                // Scroll to button smoothly if scrollToButton is enabled
                if (scrollToButton) {
                    console.log(`📜 Scrolling to load more button...`);
                    
                    // Get button position
                    const buttonBox = await loadMoreButton.boundingBox();
                    if (buttonBox) {
                        // Scroll to button with some offset so it's not at the very bottom
                        const scrollY = buttonBox.y - 200;
                        
                        // Human-like smooth scrolling with randomization
                        await page.evaluate((targetY) => {
                            const currentY = window.scrollY;
                            const distance = targetY - currentY;
                            // Slower, more randomized duration (2-4 seconds)
                            const duration = 2000 + Math.random() * 2000;
                            const startTime = performance.now();
                            
                            function easeInOutQuad(t) {
                                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                            }
                            
                            function scrollStep(currentTime) {
                                const elapsed = currentTime - startTime;
                                const progress = Math.min(elapsed / duration, 1);
                                
                                const ease = easeInOutQuad(progress);
                                const newY = currentY + (distance * ease);
                                
                                // Add small random variations to make it more human
                                const randomOffset = (Math.random() - 0.5) * 10;
                                
                                window.scrollTo(0, newY + randomOffset);
                                
                                if (progress < 1) {
                                    requestAnimationFrame(scrollStep);
                                }
                            }
                            
                            requestAnimationFrame(scrollStep);
                        }, scrollY);
                        
                        // Wait for scroll to complete
                        await page.waitForTimeout(2500 + Math.random() * 1500);
                        
                        // Additional human-like pause before clicking (2-5 seconds)
                        console.log(`⏳ Waiting before clicking button...`);
                        await page.waitForTimeout(2000 + Math.random() * 3000);
                    }
                }
                
                await loadMoreButton.click();
                loadMoreClicks++;
                
                await page.waitForTimeout(2000);
                
                const currentListSize = await page.locator(`${listSelector} li`).count();
                console.log(`📝 Current job count: ${currentListSize}`);

				await closePopups(page, websiteData);
                
            } catch (error) {
                console.log(`ℹ️ Load more button not found or not clickable: ${error.message}`);
                break;
            }
        }
        
        if (loadMoreClicks >= maxClicks) {
            console.log(`⚠️ Reached maximum clicks (${maxClicks}) for safety`);
        }
        
        console.log(`📋 Extracting job URLs from ${fullUrl}...`);
        
        try {
            const listItems = await page.locator(`${listSelector}`).all();
            console.log(`📝 Found ${listItems.length} job listings`);
            
            for (let i = 0; i < listItems.length; i++) {
                try {
                    const linkSelector = listingLink;
                    const jobLink = await listItems[i].locator(linkSelector).first();
                    const href = await jobLink.getAttribute('href');
                    
                    if (href) {
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                        
                        // Extract basic job info from listing
                        const { listingJobName, listingJobCompany } = websiteData;
                        let jobName = null;
                        let companyName = null;
                        
                        if (listingJobName) {
                            jobName = await listItems[i].locator(listingJobName).first().textContent().catch(() => null);
                            if (jobName) jobName = jobName.replace(/\s+/g, ' ').trim();
                        }
                        
                        if (listingJobCompany) {
                            companyName = await listItems[i].locator(listingJobCompany).first().textContent().catch(() => null);
                            if (companyName) companyName = companyName.replace(/\s+/g, ' ').trim();
                        }
                        
                        // Check for duplicate if we have both job name and company
                        let isDuplicate = false;
                        if (jobName && companyName) {
                            isDuplicate = await checkJobDuplicate(jobName, companyName, absoluteUrl);
                            if (isDuplicate) {
                                console.log(`🔄 Duplicate found: ${jobName} at ${companyName}`);
                                continue; // Skip this job
                            }
                        }
                        
                        allJobUrls.push({
                            url: absoluteUrl,
                            source: urlPath,
                            website: name,
                            jobName: jobName,
                            companyName: companyName
                        });
                    }
                } catch (linkError) {
                    continue;
                }
            }
        } catch (listError) {
            console.error(`❌ Error extracting job URLs: ${listError.message}`);
        }
        
        await page.close();
        console.log(`✅ Completed crawling ${urlPath}`);
    }
    
    await browser.close();
    
    console.log(`\n🎯 CRAWLING COMPLETE FOR ${name}`);
    console.log(`📊 Total job URLs found: ${allJobUrls.length}`);
    console.log('\n📋 Job URLs:');
    
    allJobUrls.forEach((job, index) => {
        console.log(`${index + 1}. [${job.source}] ${job.url}`);
    });
    
    return allJobUrls;
}

async function saveJobDataToAPI(jobData, baseApiUrl = 'http://localhost:3000', retries = 3) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const urlObj = new URL(jobData.url);
			jobData.job_url = urlObj.pathname + urlObj.search;
			
			const createJobPayload = {
				job_name: jobData.job_name,
				job_description: jobData.job_description,
				company_name: jobData.company_name,
				location: jobData.location,
				publication_date: jobData.publication_date,
				website_name: jobData.website_name,
				website_url: urlObj.origin,
				job_url: jobData.job_url,
				tags: []
			};

			const response = await axios.post(`${baseApiUrl}/api/jobs`, createJobPayload);
			
			if (response.status === 201) {
				return response.data.id;
			}
			
		} catch (error) {
			if (error.response?.status === 409) {
				// Duplicate job - not an error, just skip
				return 'duplicate';
			}
			
			if (attempt === retries) {
				console.error(`❌ Final attempt ${attempt} failed for "${jobData.job_name}":`, error.response?.data?.error || error.message);
				return null;
			}
			
			console.log(`⚠️ Attempt ${attempt}/${retries} failed for "${jobData.job_name}", retrying in ${attempt}s...`);
			await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
		}
	}
	return null;
}

async function getJobDataField(page, field) {
	if (!field) {
		return null;
	}

	const { selector, sanitize, split, translate, joinAfterSplit } = field;
	let text = null;

	try {
		text = await page.locator(selector).first().textContent().catch(() => null);
	} catch (error) {
		console.error(`❌ Error getting job data field: ${error.message}`);
		return null;
	}

	let parts = null;

	if (sanitize) {
		text = text.replace(/\s+/g, ' ').trim();
	}

	if (split) {
		parts = text.split(split);
	}

	if (translate && parts) {
		for (let i = 0; i < parts.length; i++) {
			let txt = parts[i].trim().toLowerCase();

			if (translate[txt]) {
				parts[i] = translate[txt];
			}
		}
	}

	if (translate && !parts) {
		text = translate[text] || text;
	}

	if (joinAfterSplit && parts) {
		text = parts.join(joinAfterSplit);
	} else if (parts) {
		return parts;
	}

	return text;
}

async function extractJobData(page, url, selectors) {
    try {
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });
        
        // Add human-like delay after page load
        await page.waitForTimeout(500 + Math.random() * 1000);

		const {
			jobName,
			companyName,
			jobDescription,
			jobLocation,
			publicationDate
		} = selectors;

		return {
			url: url,
			job_name: await getJobDataField(page, jobName),
			company_name: await getJobDataField(page, companyName),
			job_description: await getJobDataField(page, jobDescription),
			location: await getJobDataField(page, jobLocation),
			publication_date: await getJobDataField(page, publicationDate)
		}
    } catch (error) {
        console.error(`❌ Error extracting data from ${url}:`, error.message);
        return null;
    }
}

async function processJobUrls(jobUrls) {
    const totalUrls = Object.values(jobUrls).flat().length;
    console.log(`\n🔍 Starting parallel job processing for ${totalUrls} URLs...`);
    
    const browser = await chromium.launch({ 
        headless: true,
        executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--no-first-run',
            '--disable-default-apps'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation'],
        geolocation: { latitude: 40.7128, longitude: -74.0060 },
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    // Add minimal stealth scripts to every page
    await context.addInitScript(() => {
        // Remove webdriver property (main automation indicator)
        if ('webdriver' in navigator) {
            delete navigator.webdriver;
        }
        
        // Only override if chrome object doesn't exist (avoid breaking existing functionality)
        if (!window.chrome) {
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
        }
        
        // Minimal screen properties (only if missing)
        if (!screen.availTop) Object.defineProperty(screen, 'availTop', { get: () => 0 });
        if (!screen.availLeft) Object.defineProperty(screen, 'availLeft', { get: () => 0 });
        if (!screen.colorDepth) Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        if (!screen.pixelDepth) Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    });
    
    const page = await context.newPage();
    
    // Parallel processing tracking
    const savePromises = [];
    const maxConcurrentSaves = 5;
    let activeSaves = 0;
    let processed = 0;
    let savedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    const batchSize = 10;

    // Helper function to track API saves
    const saveJobWithTracking = async (jobData) => {
        const result = await saveJobDataToAPI(jobData);
        if (result === 'duplicate') {
            duplicateCount++;
            console.log(`🔄 Duplicate ${duplicateCount}: ${jobData.job_name}`);
        } else if (result) {
            savedCount++;
            console.log(`✅ Saved ${savedCount}/${totalUrls}: ${jobData.job_name} (ID: ${result})`);
        } else {
            skippedCount++;
            console.log(`❌ Failed ${skippedCount}: ${jobData.job_name}`);
        }
        activeSaves--;
        return result;
    };

    // Helper function to manage concurrent API calls
    const manageConcurrency = async () => {
        while (activeSaves >= maxConcurrentSaves) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    for (const websiteKey of Object.keys(jobUrls)) {
        const websiteUrls = jobUrls[websiteKey];
        const websiteData = websitesData[websiteKey];
        
        if (!websiteData || !websiteData.jobDataSelectors) {
            console.log(`⚠️ No selectors defined for ${websiteKey}, skipping...`);
            continue;
        }
        
        console.log(`\n📖 Processing ${websiteUrls.length} URLs from ${websiteData.name}...`);
        
        for (let i = 0; i < websiteUrls.length; i += batchSize) {
            const batch = websiteUrls.slice(i, i + batchSize);
            
            for (const jobUrlData of batch) {
                console.log(`📖 Processing ${processed + 1}/${totalUrls}: ${jobUrlData.url}`);
                
                const jobData = await extractJobData(page, jobUrlData.url, websiteData.jobDataSelectors);
                if (jobData && jobData.job_name && jobData.company_name) {
                    jobData.website_name = websiteData.name;
                    jobData.source = jobUrlData.source;
                    
                    // Manage concurrency before starting new save
                    await manageConcurrency();
                    
                    // Start API save immediately (don't await)
                    activeSaves++;
                    const savePromise = saveJobWithTracking(jobData)
                        .catch(error => {
                            console.error(`❌ Unexpected error saving ${jobData.job_name}:`, error.message);
                            skippedCount++;
                            activeSaves--;
                            return null;
                        });
                    
                    savePromises.push(savePromise);
                } else {
                    console.log(`⚠️ Skipping job with missing data: ${jobUrlData.url}`);
                    skippedCount++;
                }
                
                processed++;
                await page.waitForTimeout(300 + Math.random() * 700); // Random delay 300-1000ms
            }
            
            console.log(`✅ Completed extraction batch ${Math.ceil((i + batchSize) / batchSize)} of ${Math.ceil(websiteUrls.length / batchSize)} for ${websiteData.name}`);
            await page.waitForTimeout(500);
        }
    }
    
    // Wait for all remaining API saves to complete
    console.log(`\n⏳ Waiting for ${savePromises.length} remaining API saves to complete...`);
    await Promise.allSettled(savePromises);
    
    await browser.close();
    
    console.log(`\n🎯 PARALLEL PROCESSING COMPLETE`);
    console.log(`📊 Total URLs processed: ${processed}`);
    console.log(`✅ Successfully saved: ${savedCount} jobs`);
    console.log(`🔄 Duplicates skipped: ${duplicateCount} jobs`);
    console.log(`❌ Failed to save: ${skippedCount} jobs`);
    
    return { processed, savedCount, duplicateCount, skippedCount };
}

async function main() {
    console.log('🚀 Starting job crawler...');
    
    const allResults = {};
    
    for (const website of Object.keys(websitesData)) {
        try {
			const websiteData = websitesData[website];
			allResults[website] = await crawlWebsite(websiteData);
			
            console.log(`\n⏳ Waiting before next website...\n`);

            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`❌ Error crawling ${website.name}:`, error);
        }
    }
    
    console.log('\n🎉 URL COLLECTION COMPLETED!');
    const totalUrls = Object.values(allResults).flat().length;
    console.log(`📊 Total URLs collected: ${totalUrls}`);
    
    if (Object.keys(allResults).length > 0) {
        const results = await processJobUrls(allResults);
        
        console.log(`\n🎯 FINAL SUMMARY`);
        console.log(`📊 Total URLs processed: ${results.processed}`);
        console.log(`✅ Successfully saved: ${results.savedCount} jobs`);
        console.log(`🔄 Duplicates skipped: ${results.duplicateCount} jobs`);
        console.log(`❌ Failed to save: ${results.skippedCount} jobs`);
        
        const successRate = ((results.savedCount / results.processed) * 100).toFixed(1);
        console.log(`📈 Success rate: ${successRate}%`);
    } else {
        console.log('⚠️ No URLs collected to process');
    }
}

main()
    .then(() => {
		for (const website of Object.keys(websitesData)) {
			const websiteData = websitesData[website];
			crawlWebsite(websiteData);
		}

        console.log('✅ Process completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });