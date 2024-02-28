const { flatten } = require("@jrc03c/js-math-tools")
const { JSDOM, VirtualConsole } = require("jsdom")
const absolutifyUrl = require("./helpers/absolutify-url")
const fs = require("node:fs")
const Logger = require("@jrc03c/logger")
const pathJoin = require("./helpers/path-join")
const pause = require("@jrc03c/pause")
const RobotsConfig = require("./helpers/robots-config")

const virtualConsole = new VirtualConsole()
virtualConsole.on("error", () => {})

function getAllElements(dom, root) {
  root = root || dom.window.document.body
  const out = [root]

  if (root.children) {
    Array.from(root.children).forEach(child => {
      out.push(...getAllElements(dom, child))
    })
  }

  return flatten(out)
}

class WebCrawler {
  defaultPageTTL = 1000 * 60 * 60 * 24 // 24 hours
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

    this.defaultPageTTL =
      typeof options.defaultPageTTL === "undefined"
        ? this.defaultPageTTL
        : options.defaultPageTTL

    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
    this.logger = new Logger({ path: logsDir })
    this.logger.load()

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

        this.emit("warn", { domain, message })
        this.logger.logWarning(message)
        return new RobotsConfig()
      }
    })()

    // fetch and parse sitemap(s)
    const toCrawl = await (async () => {
      if (config.sitemapUrls.length === 0) {
        config.sitemapUrls.push("https://" + pathJoin(domain, "sitemap.xml"))
        config.sitemapUrls.push("https://" + pathJoin(domain, "sitemap.txt"))
      }

      const toCrawl = []

      for (const sitemapUrl of config.sitemapUrls) {
        const response = await fetch(sitemapUrl)

        if (response.status === 200) {
          const raw = await response.text()

          if (sitemapUrl.toLowerCase().endsWith(".xml")) {
            try {
              const dom = new JSDOM(raw, {
                contentType: "text/xml",
                virtualConsole,
              })

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
            } catch (e) {
              const message = `Error parsing sitemap: (${sitemapUrl}) ${e}`
              this.emit("error", { message, sitemapUrl })
              this.logger.logError(message)

              config.sitemapUrls.splice(
                config.sitemapUrls.indexOf(sitemapUrl),
                1,
              )
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

          this.emit("error", { message, response, sitemapUrl })
          this.logger.logError(message)
          config.sitemapUrls.splice(config.sitemapUrls.indexOf(sitemapUrl), 1)
        }
      }

      return toCrawl
    })()

    this.domainConfigs[domain] = config

    toCrawl.forEach(url => {
      this.frontier.push(url)
      this.emit("url-added", url)
    })

    return config
  }

  emit(channel, payload) {
    if (this.subscriptions[channel]) {
      this.subscriptions[channel].forEach(callback => callback(payload))
    }

    return this
  }

  async getDomainConfiguration(domain) {
    if (this.domainConfigs[domain]) {
      return this.domainConfigs[domain]
    } else {
      return await this.createDomainConfiguration(domain)
    }
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

      const config = await this.createDomainConfiguration(new URL(url).hostname)
      fs.writeFileSync("temp-config.json", JSON.stringify(config), "utf8")
      this.frontier.push(url)
      this.emit("url-added", url)
    }

    while (this.frontier.length > 0) {
      while (this.isPaused) {
        await pause(this.delay)
      }

      const url = this.frontier.shift()

      if (this.visited.indexOf(url) > -1) {
        this.logger.logInfo(`URL already visited or filtered: ${url}`)
        continue
      }

      this.visited.push(url)

      if (!this.filter(url)) {
        this.logger.logInfo(`URL did not pass through filter: ${url}`)
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
        this.logger.logInfo(`URL not allowed by bot rules: ${url}`)
        continue
      }

      try {
        const response = await fetch(url)
        this.emit("fetch", { response, url })

        if (response.status === 200) {
          if (this.shouldHonorBotRules) {
            const xRobotsTag = response.headers.get("x-robots-tag")

            if (xRobotsTag && xRobotsTag === "noindex") {
              this.logger.logInfo(`URL not allowed by bot rules: ${url}`)
              await pause(this.delay)
              continue
            }
          }

          const raw = await response.text()

          try {
            // NOTE: This `try` block currently implies that we're always
            // crawling HTML pages; but that may not always be true! Do we want
            // to cache, for example, the contents of JS or CSS files? If so,
            // then we need to rework this block.
            const dom = new JSDOM(raw, { virtualConsole })

            if (this.shouldHonorBotRules) {
              const metas = Array.from(
                dom.window.document.querySelectorAll("meta"),
              )

              const meta = metas.find(meta => meta.name === "robots")

              if (meta && meta.content.includes("noindex")) {
                this.logger.logInfo(`URL not allowed by bot rules: ${url}`)
                await pause(this.delay)
                continue
              }
            }

            if (
              !this.shouldOnlyFollowSitemap ||
              config.sitemapUrls.length === 0
            ) {
              getAllElements(dom).forEach(el => {
                if (!el.href && !el.src) return
                const newUrl = absolutifyUrl(url, el.href || el.src)

                if (newUrl.includes("about:blank")) {
                  this.logger.shouldWriteToStdout = true

                  this.logger.logWarning(
                    `This partial URL was converted into a URL containing "about:blank": ${el.href} (page: ${url}, result: ${newUrl})`,
                  )

                  this.logger.shouldWriteToStdout = false
                }

                if (
                  this.frontier.indexOf(newUrl) < 0 &&
                  this.visited.indexOf(newUrl) < 0
                ) {
                  this.frontier.push(newUrl)
                  this.emit("url-added", newUrl)
                }
              })
            }

            this.emit("crawl", { dom, raw, url })
            this.logger.logInfo(`Crawled URL: ${url}`)
            await pause(this.delay)
          } catch (e) {
            const message = `Error processing contents of URL: (${url}) ${e}`
            this.emit("error", { message, url })
            this.logger.logError(message)
          }
        } else {
          const message = `Error fetching URL: (${response.status}) ${url}`
          this.emit("error", { message, response, url })
          this.logger.logError(message)
        }
      } catch (e) {
        const message = `Error fetching URL: (${url}) ${e}`
        this.emit("error", { message, url })
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
