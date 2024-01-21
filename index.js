const { hash } = require("@jrc03c/js-crypto-helpers")
const { JSDOM } = require("jsdom")
const absolutifyUrl = require("./helpers/absolutify-url")
const FileDB = require("@jrc03c/filedb")
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
  subscriptions = {}
  visited = []

  constructor(options) {
    this.db = new FileDB(options.dir)
    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
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
    this.db.writeSync("/domain-configs/" + domain, config)
    this.db.writeSync("/frontier", this.frontier)
    return this
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
    this.frontier.push(url)

    while (this.frontier.length > 0) {
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
      const config = this.domainConfigs[domain]

      if (!config) {
        await this.createDomainConfiguration(domain)
      }

      if (!config.isAllowed("*", new URL(url).pathname)) {
        continue
      }

      const response = await fetch(url)

      if (response.status === 200) {
        const xRobotsTag = response.headers.get("x-robots-tag")

        if (xRobotsTag && xRobotsTag === "noindex") {
          continue
        }

        const raw = await response.text()

        try {
          const dom = new JSDOM(raw)
          const metas = Array.from(dom.window.document.querySelectorAll("meta"))
          const meta = metas.find(meta => meta.name === "robots")

          if (meta && meta.content.includes("noindex")) {
            continue
          }

          const key = await hash(url)

          this.db.writeSync("/index/" + key, {
            lastCrawlDate: new Date().toJSON(),
            raw,
          })

          const anchors = Array.from(dom.window.document.querySelectorAll("a"))
          anchors.forEach(a => this.frontier.push(absolutifyUrl(url, a.href)))
          this.db.writeSync("/frontier", this.frontier)
          this.emit("crawl", url)
          await pause(this.delay)
        } catch (e) {
          // ...
        }
      } else {
        this.emit("error", `Error fetching URL: (${response.status}) ${url}`)
      }
    }

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
