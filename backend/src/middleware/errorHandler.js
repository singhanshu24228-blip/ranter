export function notFound(_req, res) {
  res.status(404).json({ message: "Route not found." });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error.",
  });
}
