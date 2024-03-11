const { flatten } = require("@jrc03c/js-math-tools")

function getAllElements(dom, root) {
  if (!root) {
    return getAllElements(dom, dom.window.document.head).concat(
      getAllElements(dom, dom.window.document.body),
    )
  }

  const out = [root]

  if (root.children) {
    Array.from(root.children).forEach(child => {
      out.push(...getAllElements(dom, child))
    })
  }

  return flatten(out)
}

module.exports = getAllElements
