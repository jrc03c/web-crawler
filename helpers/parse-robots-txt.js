function parsePathPatterns(rule) {
  if (rule.includes(",")) {
    return rule
      .split(",")
      .map(v => parsePathPatterns(v))
      .flat()
  }

  return [
    new RegExp(rule.replaceAll("*", ".*?") + (rule.endsWith("/") ? "" : "/")),
  ]
}

function parseRobotsTxt(raw) {
  const lines = raw.split("\n").filter(line => !line.startsWith("#"))
  const out = {}
  let agent = null

  for (const line of lines) {
    if (line.toLowerCase().trim().startsWith("user-agent")) {
      agent = line.split(":").slice(1).join(":").trim()
      out[agent] = {}
    }

    if (agent) {
      const lowerLine = line.toLowerCase().trim()

      if (lowerLine.startsWith("allow") || lowerLine.startsWith("disallow")) {
        const key = lowerLine.split(":")[0]
        const rule = line.split(":").slice(1).join(":").trim()
        const patterns = parsePathPatterns(rule)

        if (!out[agent][key]) {
          out[agent][key] = []
        }

        out[agent][key] = out[agent][key].concat(patterns)
      }
    }
  }

  return out
}

module.exports = parseRobotsTxt
