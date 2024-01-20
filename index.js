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

    url = url instanceof URL ? url.toString() : url

    // fetch and parse robots.txt from the start domain
    await (async () => {
      const { protocol, hostname } = new URL(url)
      const robotsUrl = pathJoin(protocol + "//" + hostname, "robots.txt")
      const response = await fetch(robotsUrl)

      if (response.status === 200) {
        const raw = await response.text()
        const config = RobotsConfig.parse(raw)
        this.domainConfigs[hostname] = config
      } else {
        this.emit(
          "warn",
          `No robots.txt file was found for the domain "${hostname}"!`,
        )

        this.domainConfigs[hostname] = new RobotsConfig()
      }
    })()

    // fetch and parse sitemap(s)
    await (async () => {
      const { protocol, hostname } = new URL(url)
      const config = this.domainConfigs[hostname]
      const sitemapUrls = config.sitemapUrls || []

      if (sitemapUrls.length === 0) {
        sitemapUrls.push(pathJoin(protocol + "//" + hostname, "sitemap.xml"))
        sitemapUrls.push(pathJoin(protocol + "//" + hostname, "sitemap.txt"))
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
                this.frontier.push(loc)
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
              .forEach(v => this.frontier.push(v))
          }
        } else {
          this.emit(
            "error",
            `Error fetching sitemap: (${response.status}) ${sitemapUrl}`,
          )
        }
      }
    })()

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
