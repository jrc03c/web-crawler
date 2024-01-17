const { hash } = require("@jrc03c/js-crypto-helpers")
const { JSDOM } = require("jsdom")
const FileDB = require("@jrc03c/filedb")
const parseRobotsTxt = require("./helpers/parse-robots-txt")
const pause = require("@jrc03c/pause")

class WebCrawler {
  cacheDir = null
  delay = 100
  filter = () => true
  frontier = []
  isCrawling = false
  isPaused = false
  logs = []
  subscriptions = {}
  visited = []

  constructor(options) {
    this.cacheDir = options.cacheDir
    this.delay = options.delay || this.delay
    this.filter = options.filter || this.filter
  }

  clearCache() {
    this.emit("clear-cache")
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

  async start(url, robots, sitemap) {
    if (this.isCrawling) return
    this.isCrawling = true
    this.isPaused = false
    this.emit("start")

    robots = robots || new URL(url).hostname + "/robots.txt"
    sitemap = sitemap || new URL(url).hostname + "/sitemap.xml"

    await (async () => {
      try {
        const response = await fetch(robots)
        const raw = await response.text()
        const rules = parseRobotsTxt(raw)
      } catch (e) {
        // ...
      }
    })()

    this.frontier.push(url)

    while (this.frontier.length > 0) {
      const next = this.frontier.shift()
      this.visited.push(next)

      try {
        const response = await fetch(next)

        if (response.status === 200) {
          const raw = await response.text()
          const dom = new JSDOM(raw)

          this.frontier = this.frontier.concat(
            Array.from(dom.window.document.querySelectorAll("a"))
              .filter(
                a =>
                  !this.visited.includes(a.href) &&
                  !this.frontier.includes(a.href) &&
                  !disallowed.includes(a.href), // this isn't real!
              )
              .filter(a => this.filter(a.href)),
          )
        } else if (response.status === 301 || response.status === 302) {
          // ...
        } else {
          // ...
        }
      } catch (e) {}
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
