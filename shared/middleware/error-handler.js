// Error handling middleware

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    status: 404
  });
}

export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: err.name || 'Error',
    message: message,
    status: status,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

export default { notFoundHandler, errorHandler };
