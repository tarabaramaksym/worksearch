/**
 * Validate job creation data
 */
const validateJobCreation = (req, res, next) => {
    const { job_name, company_name, company_id, website_id, website_name, website_url } = req.body;

    const errors = [];

    if (!job_name || job_name.trim() === '') {
        errors.push('job_name is required');
    }

    if (!company_name && !company_id) {
        errors.push('Either company_name or company_id is required');
    }

    if (!website_id && (!website_name || !website_url)) {
        errors.push('Either website_id or (website_name and website_url) is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors
        });
    }

    next();
};

/**
 * Validate duplicate check data
 */
const validateDuplicateCheck = (req, res, next) => {
    const { job_name, company_name } = req.body;

    if (!job_name || !company_name) {
        return res.status(400).json({
            error: 'Missing required fields: job_name, company_name'
        });
    }

    next();
};

/**
 * Validate applied status update
 */
const validateAppliedUpdate = (req, res, next) => {
    const { applied } = req.body;

    if (typeof applied !== 'boolean') {
        return res.status(400).json({
            error: 'Applied field must be boolean'
        });
    }

    next();
};

/**
 * Validate tag creation
 */
const validateTagCreation = (req, res, next) => {
    const { tag_name } = req.body;

    if (!tag_name || tag_name.trim() === '') {
        return res.status(400).json({
            error: 'tag_name is required'
        });
    }

    next();
};

/**
 * Validate company creation
 */
const validateCompanyCreation = (req, res, next) => {
    const { company_name } = req.body;

    if (!company_name || company_name.trim() === '') {
        return res.status(400).json({
            error: 'company_name is required'
        });
    }

    next();
};

/**
 * Validate location creation
 */
const validateLocationCreation = (req, res, next) => {
    const { location } = req.body;

    if (!location || location.trim() === '') {
        return res.status(400).json({
            error: 'location is required'
        });
    }

    next();
};

/**
 * Validate website creation
 */
const validateWebsiteCreation = (req, res, next) => {
    const { website_name, website_url } = req.body;

    const errors = [];

    if (!website_name || website_name.trim() === '') {
        errors.push('website_name is required');
    }

    if (!website_url || website_url.trim() === '') {
        errors.push('website_url is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors
        });
    }

    next();
};

module.exports = {
    validateJobCreation,
    validateDuplicateCheck,
    validateAppliedUpdate,
    validateTagCreation,
    validateCompanyCreation,
    validateLocationCreation,
    validateWebsiteCreation
}; 