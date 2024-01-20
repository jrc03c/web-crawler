const { JSDOM } = require("jsdom")
const pathJoin = require("./helpers/path-join")
const RobotsConfig = require("./helpers/robots-config")

class WebCrawler {
  delay = 100
  domainConfigs = {}
  filter = () => true
  frontier = []
  isCrawling = false
  isPaused = false
  logs = []
  subscriptions = {}
  visited = []

  constructor(options) {
    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
  }

  async createDomainConfiguration(domain) {
    // fetch and parse robots.txt
    const config = await (async () => {
      const robotsUrl = pathJoin("https://" + domain, "robots.txt")
      const response = await fetch(robotsUrl)

      if (response.status === 200) {
        const raw = await response.text()
        const config = RobotsConfig.parse(raw)
        return config
      } else {
        this.emit(
          "warn",
          `No robots.txt file was found for the domain "${domain}"!`,
        )

        return new RobotsConfig()
      }
    })()

    // fetch and parse sitemap(s)
    const toCrawl = await (async () => {
      const sitemapUrls = config.sitemapUrls || []
      const toCrawl = []

      if (sitemapUrls.length === 0) {
        sitemapUrls.push(pathJoin("https://" + domain, "sitemap.xml"))
        sitemapUrls.push(pathJoin("https://" + domain, "sitemap.txt"))
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
          this.emit(
            "error",
            `Error fetching sitemap: (${response.status}) ${sitemapUrl}`,
          )
        }
      }

      return toCrawl
    })()

    this.domainConfigs[domain] = config
    toCrawl.forEach(url => this.frontier.push(url))
    return this
  }

  emit(channel, payload) {
    this.subscriptions[channel].forEach(callback => callback(payload))
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

    if (typeof url !== "string") {
      throw new Error(
        "The value passed into the `start` method must be a URL in string form!",
      )
    }

    await this.createDomainConfiguration(new URL(url).hostname)

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
