const ResponseFormatter = require('../utils/ResponseFormatter');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json(ResponseFormatter.formatError(err.message, 400));
    }

    if (err.message.includes('not found')) {
        return res.status(404).json(ResponseFormatter.formatError(err.message, 404));
    }

    if (err.message.includes('already exists')) {
        const response = ResponseFormatter.formatError(err.message, 409);
        if (err.isDuplicate && err.existingJob) {
            response.existing_job_id = err.existingJob.entity_id;
        }
        return res.status(409).json(response);
    }

    if (err.message.includes('required')) {
        return res.status(400).json(ResponseFormatter.formatError(err.message, 400));
    }

    // Default server error
    return res.status(500).json(ResponseFormatter.formatError('Internal server error', 500));
};

/**
 * Async error wrapper - catches async errors and passes them to error handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 404 handler for unknown routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route ${req.originalUrl} not found`);
    error.status = 404;
    next(error);
};

module.exports = {
    errorHandler,
    asyncHandler,
    notFoundHandler
}; 