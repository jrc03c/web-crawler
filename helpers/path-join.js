function pathJoin() {
  const args = Array.from(arguments)

  if (args.length === 0) {
    return ""
  }

  let startsWithForwardSlash = !!args.find(arg => arg.trim().startsWith("/"))

  const parts = (() => {
    let temp = args.join("/").trim()

    while (temp.includes("//")) {
      temp = temp.replaceAll("//", "/")
    }

    while (temp.match(/\/\.\//g)) {
      temp = temp.replaceAll(/\/\.\//g, "/")
    }

    temp = temp.replace(/^\.\//, "")
    temp = temp.replace(/\/\.$/, "")

    temp = temp
      .split("/")
      .map(v => v.trim())
      .filter(v => v.length > 0)

    return temp
  })()

  let out = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (i === 0) {
      out.push(part)
    } else {
      if (part === "..") {
        if (out.length > 0) {
          out.pop()
        } else {
          out.push(part)
        }
      } else {
        out.push(part)
      }
    }
  }

  out = out.join("/")
  return (startsWithForwardSlash && !out.startsWith("..") ? "/" : "") + out
}

module.exports = pathJoin
