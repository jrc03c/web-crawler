const { set, sort } = require("@jrc03c/js-math-tools")
const absolutifyUrl = require("./absolutify-url")

function extractUrlsFromCss(url, css) {
  return sort(
    set(
      (css.match(/url\(.*?\)/g) || []).map(v =>
        absolutifyUrl(
          url,
          v
            .replace("url(", "")
            .replace(")", "")
            .replaceAll("'", "")
            .replaceAll('"', ""),
        ),
      ),
    ),
  )
}

module.exports = extractUrlsFromCss
