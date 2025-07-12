class ResponseFormatter {
    /**
     * Format a single job with related data
     */
    static formatJob(jobRow) {
        if (!jobRow) return null;
        
        return {
            ...jobRow,
            tags: jobRow.tags ? jobRow.tags.split(',').map(tag => {
                const [name, category] = tag.split(':');
                return { name, category };
            }) : [],
            locations: jobRow.locations ? jobRow.locations.split(',') : [],
            applied: Boolean(jobRow.applied)
        };
    }

    /**
     * Format multiple jobs
     */
    static formatJobs(jobRows) {
        if (!Array.isArray(jobRows)) return [];
        
        return jobRows.map(row => this.formatJob(row));
    }

    /**
     * Format API response with jobs
     */
    static formatJobsResponse(jobRows, includeQuery = null) {
        const jobs = this.formatJobs(jobRows);
        const response = {
            jobs,
            count: jobs.length
        };
        
        if (includeQuery) {
            response.query = includeQuery;
        }
        
        return response;
    }

    /**
     * Format single job response
     */
    static formatJobResponse(jobRow) {
        const job = this.formatJob(jobRow);
        return { job };
    }

    /**
     * Format success response
     */
    static formatSuccess(message, data = null) {
        const response = { message };
        if (data) {
            Object.assign(response, data);
        }
        return response;
    }

    /**
     * Format error response
     */
    static formatError(error, statusCode = 500) {
        return {
            error: typeof error === 'string' ? error : error.message || 'Unknown error',
            statusCode
        };
    }

    /**
     * Format creation response
     */
    static formatCreated(id, message = 'Created successfully', warnings = null) {
        const response = { id, message };
        if (warnings && warnings.length > 0) {
            response.warnings = warnings;
        }
        return response;
    }

    /**
     * Format duplicate check response
     */
    static formatDuplicateCheck(isDuplicate, message, existingJob = null) {
        const response = {
            isDuplicate,
            message
        };
        
        if (existingJob) {
            response.existingJob = {
                id: existingJob.entity_id,
                job_name: existingJob.job_name,
                company_name: existingJob.company_name
            };
        }
        
        return response;
    }

    /**
     * Format list response (for tags, companies, locations, websites)
     */
    static formatList(items, itemName) {
        return {
            [itemName]: items,
            count: items.length
        };
    }
}

module.exports = ResponseFormatter; 