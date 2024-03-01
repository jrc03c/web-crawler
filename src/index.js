const { flatten } = require("@jrc03c/js-math-tools")
const { JSDOM, VirtualConsole } = require("jsdom")
const absolutifyUrl = require("./helpers/absolutify-url")
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
  static DisallowReasons = {
    DISALLOWED_BY_BOT_RULES: "DISALLOWED_BY_BOT_RULES",
    DISALLOWED_BY_META_TAG: "DISALLOWED_BY_META_TAG",
    DISALLOWED_BY_RESPONSE_HEADER: "DISALLOWED_BY_RESPONSE_HEADER",
  }

  // lifecycle events:
  // start
  // warn
  // error
  // before-crawl
  // fetch
  // after-crawl
  // add-url
  // skip-url
  // filter-url
  // disallow-url
  // pause
  // stop
  // finish

  delay = 100
  domainConfigs = {}
  filter = () => true
  frontier = []
  isCrawling = false
  isPaused = false
  requestTimeout = 3000
  shouldHonorBotRules = true
  shouldOnlyFollowSitemap = true
  subscriptions = {}
  visited = []

  constructor(options) {
    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
    this.requestTimeout = options.requestTimeout || this.requestTimeout

    this.shouldHonorBotRules =
      typeof options.shouldHonorBotRules === "undefined"
        ? this.shouldHonorBotRules
        : options.shouldHonorBotRules

    this.shouldOnlyFollowSitemap =
      typeof options.shouldOnlyFollowSitemap === "undefined"
        ? this.shouldOnlyFollowSitemap
        : options.shouldOnlyFollowSitemap
  }

  addUrlToFrontier(url, shouldSkipFilter) {
    if (this.frontier.includes(url)) {
      return false
    }

    if (this.visited.includes(url)) {
      return false
    }

    if (!shouldSkipFilter) {
      if (!this.filter(url)) {
        return false
      }
    }

    this.frontier.push(url)
    this.emit("add-url", { url })
    return true
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
              this.emit("error", { message, url: sitemapUrl })

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

          this.emit("error", { message, response, url: sitemapUrl })
          config.sitemapUrls.splice(config.sitemapUrls.indexOf(sitemapUrl), 1)
        }
      }

      return toCrawl
    })()

    this.domainConfigs[domain] = config
    toCrawl.forEach(url => this.addUrlToFrontier(url))
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

    if (url) {
      if (typeof url !== "string") {
        throw new Error(
          "The value passed into the `start` method must be a URL in string form!",
        )
      }

      if (!this.frontier.includes(url) && !this.visited.includes(url)) {
        const shouldSkipFilter = true
        this.addUrlToFrontier(url, shouldSkipFilter)
      }
    }

    while (this.frontier.length > 0) {
      while (this.isPaused) {
        await pause(this.delay)
      }

      const url = this.frontier.shift()

      if (this.visited.includes(url)) {
        this.emit("skip-url", { url })
        continue
      } else {
        this.visited.push(url)
      }

      if (!this.filter(url)) {
        this.emit("filter-url", { url })
        continue
      }

      const domain = new URL(url).hostname
      let config = await this.getDomainConfiguration(domain)

      if (
        this.shouldHonorBotRules &&
        !config.isAllowed("*", new URL(url).pathname)
      ) {
        this.emit("disallow-url", {
          reason: WebCrawler.DisallowReasons.DISALLOWED_BY_BOT_RULES,
          url,
        })

        continue
      }

      try {
        this.emit("before-crawl", { url })
        const controller = new AbortController()

        const timeout = setTimeout(
          () => controller.abort(),
          this.requestTimeout,
        )

        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        const raw = await response.text()
        this.emit("fetch", { raw, response, url })

        if (response.status === 200) {
          if (this.shouldHonorBotRules) {
            const xRobotsTag = response.headers.get("x-robots-tag")

            if (xRobotsTag && xRobotsTag === "noindex") {
              this.emit("disallow-url", {
                reason:
                  WebCrawler.DisallowReasons.DISALLOWED_BY_RESPONSE_HEADER,
                url,
              })

              await pause(this.delay)
              continue
            }
          }

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
                this.emit("disallow-url", {
                  reason: WebCrawler.DisallowReasons.DISALLOWED_BY_META_TAG,
                  url,
                })

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

                if (
                  !this.frontier.includes(newUrl) &&
                  !this.visited.includes(newUrl) &&
                  this.filter(newUrl)
                ) {
                  this.addUrlToFrontier(newUrl)
                }
              })
            }

            this.emit("after-crawl", { dom, raw, response, url })
            await pause(this.delay)
          } catch (e) {
            const message = `Error processing contents of URL: (${url}) ${e}`
            this.emit("error", { message, url })
          }
        } else {
          const message = `Error fetching URL: (${response.status}) ${url}`
          this.emit("error", { message, response, url })
        }
      } catch (e) {
        const message = `Error fetching URL: (${url}) ${e}`
        this.emit("error", { message, url })
      }
    }

    this.isCrawling = false
    this.isPaused = false
    this.emit("finish")
    return this
  }

  stop() {
    this.isCrawling = false
    this.isPaused = false
    this.emit("stop")
    return this
  }
}

module.exports = WebCrawler
