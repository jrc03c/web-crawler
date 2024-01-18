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
})
