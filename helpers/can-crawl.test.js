const canCrawl = require("./can-crawl")
const parseRobotsTxt = require("./parse-robots-txt")

test("tests that the `canCrawl` function works as expected", () => {
  const robots = `
    User-agent: Spider
    Allow: /foo,/bar/baz/*
    Disallow: /why/
    Disallow: /nope/nope/nope
    Disallow: /images/*.png
    Allow: /why/because

    User-agent: *
    Allow: /temp

    User-agent: Josh
    Disallow: /everything/under/the/sun
    Disallow: /a/b/c
    Allow: /a/*/z
  `

  const rules = parseRobotsTxt(robots)

  const checks = [
    { bot: "Spider", path: "/foo", result: true },
    { bot: "Spider", path: "/foothisshouldwork", result: true },
    { bot: "Spider", path: "/bar", result: true },
    { bot: "Spider", path: "/bar/baz/test", result: true },
    { bot: "Spider", path: "/bar/baz/test.png", result: true },
    { bot: "Spider", path: "/bar/baz/test1/test2/test3", result: true },
    { bot: "Spider", path: "/why/not", result: false },
    { bot: "Spider", path: "/why/because/test.js", result: true },
    { bot: "Spider", path: "/nope", result: true },
    { bot: "Spider", path: "/nope/nope/yep", result: true },
    { bot: "Spider", path: "/nope/nope/nope/again", result: false },
    { bot: "Spider", path: "/images/test.png", result: false },
    { bot: "Spider", path: "/images/test.jpg", result: true },
    { bot: "*", path: "/temp", result: true },
    { bot: "*", path: "/a/b/c/d.png", result: true },
    { bot: "Josh", path: "/foo", result: true },
    { bot: "Josh", path: "/everything", result: true },
    { bot: "Josh", path: "/everything/under/the/sun/image.png", result: false },
    { bot: "Josh", path: "/a/w/x/y/z", result: true },
    { bot: "Samwise", path: "/to/mordor", result: true },
  ]

  checks.forEach(check => {
    expect(canCrawl(rules, check.bot, check.path)).toBe(check.result)
  })
})
