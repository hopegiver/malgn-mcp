export const errorHandler = (err, c) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return c.json({
      error: 'Validation Error',
      message: err.message
    }, 400);
  }

  if (err.name === 'NotFoundError') {
    return c.json({
      error: 'Not Found',
      message: err.message
    }, 404);
  }

  return c.json({
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong'
  }, 500);
};
