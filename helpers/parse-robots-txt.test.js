const { isEqual } = require("@jrc03c/js-math-tools")
const parseRobotsTxt = require("./parse-robots-txt")

test("test that the `parseRobotsTxt` function works as expected", () => {
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

  const rulesPred = parseRobotsTxt(robots)

  const rulesTrue = {
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

  Object.keys(rulesPred).forEach(key => {
    if (rulesPred[key].allow) rulesPred[key].allow.sort()
    if (rulesPred[key].disallow) rulesPred[key].disallow.sort()
  })

  Object.keys(rulesTrue).forEach(key => {
    if (rulesPred[key].allow) rulesPred[key].allow.sort()
    if (rulesPred[key].disallow) rulesPred[key].disallow.sort()
  })

  const keysPred = Object.keys(rulesPred).toSorted()
  const keysTrue = Object.keys(rulesTrue).toSorted()
  expect(isEqual(keysPred, keysTrue)).toBe(true)

  const stringSort = (a, b) => (a.toString() < b.toString() ? -1 : 1)

  keysTrue.forEach(key => {
    let aPred = rulesPred[key].allow
    let aTrue = rulesTrue[key].allow

    if (aPred && aTrue) {
      aPred = aPred.toSorted(stringSort)
      aTrue = aTrue.toSorted(stringSort)
      expect(isEqual(aPred, aTrue)).toBe(true)
    }

    let dPred = rulesPred[key].disallow
    let dTrue = rulesTrue[key].disallow

    if (dPred && dTrue) {
      dPred = dPred.toSorted(stringSort)
      dTrue = dTrue.toSorted(stringSort)
      expect(isEqual(dPred, dTrue)).toBe(true)
    }
  })
})
