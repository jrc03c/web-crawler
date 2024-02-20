const { copy } = require("@jrc03c/js-math-tools")
const { hash } = require("@jrc03c/js-crypto-helpers")
const { JSDOM } = require("jsdom")
const absolutifyUrl = require("./helpers/absolutify-url")
const FileDB = require("@jrc03c/filedb")
const fs = require("node:fs")
const Logger = require("@jrc03c/logger")
const pathJoin = require("./helpers/path-join")
const pause = require("@jrc03c/pause")
const RobotsConfig = require("./helpers/robots-config")

class WebCrawler {
  db = null
  delay = 100
  domainConfigs = {}
  filter = () => true
  frontier = []
  isCrawling = false
  isPaused = false
  logger = null
  shouldHonorBotRules = true
  shouldOnlyFollowSitemap = true
  subscriptions = {}
  visited = []

  constructor(options) {
    const logsDir = pathJoin(options.dir, "logs")

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    this.db = new FileDB(options.dir)
    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
    this.logger = new Logger({ path: logsDir })

    this.shouldHonorBotRules =
      typeof options.shouldHonorBotRules === "undefined"
        ? this.shouldHonorBotRules
        : options.shouldHonorBotRules

    this.shouldOnlyFollowSitemap =
      typeof options.shouldOnlyFollowSitemap === "undefined"
        ? this.shouldOnlyFollowSitemap
        : options.shouldOnlyFollowSitemap
  }

  async createDomainConfiguration(domain) {
    // fetch and parse robots.txt
    const config = await (async () => {
      const robotsUrl = "https://" + pathJoin(domain, "robots.txt")
      const response = await fetch(robotsUrl)

      if (response.status === 200) {
        const raw = await response.text()
        const config = RobotsConfig.parse(raw)
        return config
      } else {
        const message = `No robots.txt file was found for the domain "${domain}"!`

        this.emit("warn", message)
        this.logger.logWarning(message)
        return new RobotsConfig()
      }
    })()

    // fetch and parse sitemap(s)
    const toCrawl = await (async () => {
      const sitemapUrls = config.sitemapUrls || []
      const toCrawl = []

      if (sitemapUrls.length === 0) {
        sitemapUrls.push("https://" + pathJoin(domain, "sitemap.xml"))
        sitemapUrls.push("https://" + pathJoin(domain, "sitemap.txt"))
      }

      for (const sitemapUrl of sitemapUrls) {
        const response = await fetch(sitemapUrl)

        if (response.status === 200) {
          const raw = await response.text()

          if (sitemapUrl.toLowerCase().endsWith(".xml")) {
            const dom = new JSDOM(raw, { contentType: "text/xml" })

            const childNodes = Array.from(
              dom.window.document.documentElement.childNodes,
            )

            for (const child of childNodes) {
              try {
                const loc = child.querySelector("loc").innerHTML
                toCrawl.push(loc)
              } catch (e) {
                // ...
              }
            }
          }

          if (sitemapUrl.toLowerCase().endsWith(".txt")) {
            raw
              .split("\n")
              .map(v => v.trim())
              .filter(v => v.length > 0)
              .forEach(v => toCrawl.push(v))
          }
        } else {
          const message = `Error fetching sitemap: (${response.status}) ${sitemapUrl}`

          this.emit("error", message)
          this.logger.logError(message)
        }
      }

      return toCrawl
    })()

    this.domainConfigs[domain] = config
    toCrawl.forEach(url => this.frontier.push(url))

    // NOTE: I'm stringifying the bot rules because FileDB didn't like writing
    // asterisks as part of filesystem paths. So I need to be sure to parse
    // the bot rules from their stringified form when loading the crawler's
    // config from disk.
    const tempConfig = copy(config)
    tempConfig.botRules = JSON.stringify(tempConfig.botRules)

    const key = await hash(domain)
    this.db.writeSync("/domain-configs/" + key, tempConfig)
    this.db.writeSync("/frontier", this.frontier)
    return config
  }

  emit(channel, payload) {
    if (this.subscriptions[channel]) {
      this.subscriptions[channel].forEach(callback => callback(payload))
    }

    return this
  }

  off(channel, callback) {
    if (this.subscriptions[channel]) {
      const index = this.subscriptions[channel].indexOf(callback)

      if (index > -1) {
        this.subscriptions[channel].splice(index, 1)
      }
    }

    return this
  }

  on(channel, callback) {
    if (!this.subscriptions[channel]) {
      this.subscriptions[channel] = []
    }

    this.subscriptions[channel].push(callback)
    return this
  }

  pause() {
    this.isPaused = true
    this.emit("pause")
    this.logger.logInfo("Paused.")
    return this
  }

  async start(url) {
    // - fetch and parse robots.txt
    // - fetch and parse sitemap(s)
    // - add root and all pages in sitemap(s) to frontier
    // - while the frontier has urls in it:
    //   - get a url
    //   - remove the url from the frontier and add it to the "visited" list
    //   - if the url is not allowed according to robots.txt, then continue to
    //     the next url
    //   - fetch the raw contents at the url
    //   - if the response header has a "x-robots-tag: noindex" attribute, then
    //     continue to the next url
    //   - if the response text represents an html page, and that page contains
    //     a meta "noindex" tag, then continue to the next url
    //   - parse the raw response text as html
    //   - if parsing was successful, then get all urls in the page and add them
    //     to the frontier
    //   - add the content of the page to the search engine index

    if (this.isCrawling) return
    this.isCrawling = true
    this.isPaused = false
    this.emit("start")
    this.logger.logInfo("Started!")

    if (url) {
      if (typeof url !== "string") {
        throw new Error(
          "The value passed into the `start` method must be a URL in string form!",
        )
      }

      await this.createDomainConfiguration(new URL(url).hostname)
      this.frontier.push(url)
    }

    while (this.frontier.length > 0) {
      while (this.isPaused) {
        await pause(this.delay)
      }

      const url = this.frontier.shift()

      if (this.visited.includes(url)) {
        continue
      }

      this.visited.push(url)
      this.db.writeSync("/frontier", this.frontier)
      this.db.writeSync("/visited", this.visited)

      if (!this.filter(url)) {
        continue
      }

      const domain = new URL(url).hostname
      let config = this.domainConfigs[domain]

      if (!config) {
        config = await this.createDomainConfiguration(domain)
      }

      if (
        this.shouldHonorBotRules &&
        !config.isAllowed("*", new URL(url).pathname)
      ) {
        continue
      }

      const response = await fetch(url)

      if (response.status === 200) {
        if (this.shouldHonorBotRules) {
          const xRobotsTag = response.headers.get("x-robots-tag")

          if (xRobotsTag && xRobotsTag === "noindex") {
            await pause(this.delay)
            continue
          }
        }

        const raw = await response.text()

        try {
          const dom = new JSDOM(raw)

          if (this.shouldHonorBotRules) {
            const metas = Array.from(
              dom.window.document.querySelectorAll("meta"),
            )

            const meta = metas.find(meta => meta.name === "robots")

            if (meta && meta.content.includes("noindex")) {
              await pause(this.delay)
              continue
            }
          }

          const key = await hash(url)

          this.db.writeSync("/index/" + key, {
            updated: new Date().toJSON(),
            raw,
          })

          if (!this.shouldOnlyFollowSitemap) {
            const anchors = Array.from(
              dom.window.document.querySelectorAll("a"),
            )

            anchors.forEach(a => this.frontier.push(absolutifyUrl(url, a.href)))
          }

          this.db.writeSync("/frontier", this.frontier)
          this.emit("crawl", { dom, raw, url })
          this.logger.logInfo(`Crawled URL: ${url}`)
          await pause(this.delay)
        } catch (e) {
          const message = `Error processing contents of URL: (${url}) ${e}`
          this.emit("error", message)
          this.logger.logError(message)
        }
      } else {
        const message = `Error fetching URL: (${response.status}) ${url}`
        this.emit("error", message)
        this.logger.logError(message)
      }
    }

    this.isCrawling = false
    this.isPaused = false
    this.emit("finish")
    this.logger.logSuccess("Finished!")
    return this
  }

  stop() {
    this.isCrawling = false
    this.isPaused = false
    this.emit("stop")
    this.logger.logInfo("Stopped.")
    return this
  }
}

module.exports = WebCrawler
