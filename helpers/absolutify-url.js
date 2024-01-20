// The purpose of this function is to standardize path URLs that don't start
// with a protocol, like "/foo" or "hello/world". For example, if we're crawling
// https://example.com/foo/bar and we encounter a link to "hello/world", then
// the latter should be standardized into the full URL:
// "https://example.com/foo/bar/hello/world".

const extensions = require("./extensions.json")
const pathJoin = require("./path-join")

function absolutifyUrl(currentUrl, targetUrl) {
  if (targetUrl.includes("://")) {
    return targetUrl
  }

  if (targetUrl.startsWith("/")) {
    const temp = new URL(currentUrl)
    return temp.protocol + "//" + pathJoin(temp.hostname, targetUrl)
  }

  const temp = new URL(currentUrl)

  const updatedPath = extensions.some(ext => temp.pathname.includes("." + ext))
    ? temp.pathname.split("/").slice(0, -1).join("/")
    : temp.pathname

  return temp.protocol + "//" + pathJoin(temp.hostname, updatedPath, targetUrl)
}

module.exports = absolutifyUrl
