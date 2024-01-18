const { isEqual } = require("@jrc03c/js-math-tools")
const RobotsConfig = require("./robots-config")

test("test that the `RobotsConfig` class works as expected", () => {
  const robots = `
      User-agent: Spider
                Allow: /foo,/bar/baz/*
      Disallow         :/why/
        dIsAlLoW    : /nope/nope/nope
    Disallow: /images/*.png
      allow: /why/because

      User-agent                :                *
    Allow: /temp

          Sitemap: https://example.com/sitemap.xml

      USER-AGENT:Josh
      disallow: /everything/under/the/sun
      DISALLOW: /a/b/c
      Allow: /a/*/z

              siteMAP:https://helloworld.com/another-sitemap.xml
  `

  const configPred = RobotsConfig.parse(robots)
  const configTrue = new RobotsConfig()

  configTrue.botRules = {
    "*": {
      allow: [new RegExp("/temp")],
    },

    Josh: {
      allow: [new RegExp("/a/.*?/z")],
      disallow: [new RegExp("/everything/under/the/sun"), new RegExp("/a/b/c")],
    },

    Spider: {
      allow: [
        new RegExp("/foo"),
        new RegExp("/bar/baz/.*?"),
        new RegExp("/why/because"),
      ],

      disallow: [
        new RegExp("/why/"),
        new RegExp("/nope/nope/nope"),
        new RegExp("/images/.*?\\.png"),
      ],
    },
  }

  configTrue.sitemapUrls = [
    "https://example.com/sitemap.xml",
    "https://helloworld.com/another-sitemap.xml",
  ]

  Object.keys(configPred.botRules).forEach(key => {
    if (configPred.botRules[key].allow) {
      configPred.botRules[key].allow.sort()
    }

    if (configPred.botRules[key].disallow) {
      configPred.botRules[key].disallow.sort()
    }
  })

  Object.keys(configTrue.botRules).forEach(key => {
    if (configPred.botRules[key].allow) {
      configPred.botRules[key].allow.sort()
    }

    if (configPred.botRules[key].disallow) {
      configPred.botRules[key].disallow.sort()
    }
  })

  const botsPred = Object.keys(configPred.botRules).toSorted()
  const botsTrue = Object.keys(configTrue.botRules).toSorted()
  expect(isEqual(botsPred, botsTrue)).toBe(true)

  const stringSort = (a, b) => (a.toString() < b.toString() ? -1 : 1)

  botsTrue.forEach(key => {
    let aPred = configPred.botRules[key].allow
    let aTrue = configTrue.botRules[key].allow

    if (aPred && aTrue) {
      aPred = aPred.toSorted(stringSort)
      aTrue = aTrue.toSorted(stringSort)
      expect(isEqual(aPred, aTrue)).toBe(true)
    }

    let dPred = configPred.botRules[key].disallow
    let dTrue = configTrue.botRules[key].disallow

    if (dPred && dTrue) {
      dPred = dPred.toSorted(stringSort)
      dTrue = dTrue.toSorted(stringSort)
      expect(isEqual(dPred, dTrue)).toBe(true)
    }
  })

  expect(
    isEqual(
      configPred.sitemapUrls.toSorted(),
      configTrue.sitemapUrls.toSorted(),
    ),
  ).toBe(true)

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
    expect(configPred.isAllowed(check.bot, check.path)).toBe(
      configTrue.isAllowed(check.bot, check.path),
    )

    expect(configPred.isAllowed(check.bot, check.path)).toBe(check.result)
  })
})
