function countVisitors(app, visitors) {
  const currentTime = Math.floor(Date.now() / 1000);
  const fiveMinutesAgo = currentTime - (5 * 60);
  let count = 0;
  for (const visitorId in visitors) {
    const lastSeen = visitors[visitorId].lastSeen;
    if (lastSeen >= fiveMinutesAgo && lastSeen <= currentTime) {
      count++;
    }
  }
  app.locals.website_visitor = count;
}

module.exports = { countVisitors };
