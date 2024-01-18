class RobotsConfig {
  botRules = {}
  sitemapUrls = []

  static parse(raw) {
    const regexifyRuleString = rule => {
      return new RegExp(rule.replaceAll(".", "\\.").replaceAll("*", ".*?"))
    }

    const lines = raw.split("\n").filter(line => !line.startsWith("#"))
    const config = new RobotsConfig()
    let agent = null

    for (const line of lines) {
      if (line.toLowerCase().trim().startsWith("user-agent")) {
        agent = line.split(":").slice(1).join(":").trim()
        config.botRules[agent] = {}
      }

      const lowerLine = line.toLowerCase().trim()

      if (agent) {
        if (
          lowerLine.match(/^\s*allow\s*:/gim) ||
          lowerLine.match(/^\s*disallow\s*:/gim)
        ) {
          const key = lowerLine.split(":")[0].trim()
          const rule = line.split(":").slice(1).join(":").trim()
          const patterns = rule.split(",").map(rule => regexifyRuleString(rule))

          if (!config.botRules[agent][key]) {
            config.botRules[agent][key] = []
          }

          config.botRules[agent][key] =
            config.botRules[agent][key].concat(patterns)
        }
      }

      if (lowerLine.match(/^\s*sitemap\s*:/gim)) {
        const sitemap = line.split(":").slice(1).join(":").trim()
        config.sitemapUrls.push(sitemap)
      }
    }

    return config
  }

  isAllowed(bot, path) {
    if (!this.botRules[bot]) {
      if (this.botRules["*"]) {
        bot = "*"
      } else {
        return true
      }
    }

    if (this.botRules[bot].allow) {
      for (const pattern of this.botRules[bot].allow) {
        if (path.match(pattern)) {
          return true
        }
      }
    }

    if (this.botRules[bot].disallow) {
      for (const pattern of this.botRules[bot].disallow) {
        if (path.match(pattern)) {
          return false
        }
      }
    }

    return true
  }

  toString() {
    return [this.sitemapUrls.map(url => "Sitemap: " + url)]
      .concat(
        Object.keys(this.botRules)
          .toSorted()
          .map(bot =>
            ["User-agent: " + bot]
              .concat(this.botRules[bot].allow.map(path => "Allow: " + path))
              .concat(
                this.botRules[bot].disallow.map(path => "Disallow: " + path),
              ),
          ),
      )
      .join("\n")
  }
}

module.exports = RobotsConfig
