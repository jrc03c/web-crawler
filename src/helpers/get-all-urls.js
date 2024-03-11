const { set, sort } = require("@jrc03c/js-math-tools")
const extractUrlsFromCss = require("./extract-urls-from-css")
const getAllElements = require("./get-all-elements")
const getAttributeUrls = require("./get-attribute-urls")

function getAllUrls(url, dom, validAttributes) {
  return sort(
    set(
      getAllElements(dom).map(el => {
        if (el.tagName && el.tagName.toLowerCase() === "style") {
          return extractUrlsFromCss(url, el.innerHTML)
        } else {
          return getAttributeUrls(url, el, validAttributes)
        }
      }),
    ),
  )
}

module.exports = getAllUrls
