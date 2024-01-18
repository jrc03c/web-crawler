const absolutifyUrl = require("./absolutify-url")

test("tests that the `absolutifyUrl` function works as expected", () => {
  const checks = [
    [
      "https://example.com",
      "http://foo.bar/hello/world",
      "http://foo.bar/hello/world",
    ],
    ["https://example.com", "foo/bar", "https://example.com/foo/bar"],
    ["https://example.com", "./foo/bar", "https://example.com/foo/bar"],
    ["https://example.com", "/foo/bar", "https://example.com/foo/bar"],
    [
      "https://example.com/foo/bar",
      "hello/world",
      "https://example.com/foo/bar/hello/world",
    ],
    [
      "https://example.com/foo/bar",
      "./hello/world",
      "https://example.com/foo/bar/hello/world",
    ],
    [
      "https://example.com/foo/bar",
      "/hello/world",
      "https://example.com/hello/world",
    ],
    [
      "https://example.com/foo/bar",
      "../hello/world",
      "https://example.com/foo/hello/world",
    ],
    [
      "https://example.com/foo/bar.html",
      "hello/world",
      "https://example.com/foo/hello/world",
    ],
  ]

  for (const check of checks) {
    expect(absolutifyUrl(check[0], check[1])).toBe(check[2])
  }
})
