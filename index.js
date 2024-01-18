const { JSDOM } = require("jsdom")
const RobotsConfig = require("./helpers/robots-config")

class DomainConfig {
  robotsConfig = null
  urlsFromSitemaps = []
}

class WebCrawler {
  cacheDir = null
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
    // - fetch and parse robots.txt
    // - fetch and parse sitemap.xml
    // - add root and all pages in sitemap.xml to frontier
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

    // ...

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
