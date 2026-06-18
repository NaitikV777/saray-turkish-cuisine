import('./server/index.js').catch((error) => {
  console.error('Failed to start Saray app:', error);
  process.exit(1);
});
