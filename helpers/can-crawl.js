function canCrawl(rules, bot, path) {
  if (!rules[bot]) {
    if (rules["*"]) {
      bot = "*"
    } else {
      return true
    }
  }

  if (rules[bot].allow) {
    for (const pattern of rules[bot].allow) {
      if (path.match(pattern)) {
        return true
      }
    }
  }

  if (rules[bot].disallow) {
    for (const pattern of rules[bot].disallow) {
      if (path.match(pattern)) {
        return false
      }
    }
  }

  return true
}

module.exports = canCrawl
