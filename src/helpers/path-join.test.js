const pathJoin = require("./path-join")

test("tests that the `pathJoin` function works as expected", () => {
  expect(pathJoin("/foo", "/bar")).toBe("/foo/bar")
  expect(pathJoin("a", "b", "c")).toBe("a/b/c")
  expect(pathJoin("example.com", "/foo", "/bar")).toBe("example.com/foo/bar")
  expect(pathJoin("", "//hello///", "w/o/r/l/d/")).toBe("/hello/w/o/r/l/d")
  expect(pathJoin("./a/b/c", "./help")).toBe("a/b/c/help")
  expect(pathJoin(" / a/b/ c   / d/e", "../../../test")).toBe("/a/b/test")
  expect(pathJoin("/a/b", "../../../test")).toBe("../test")
  expect(pathJoin("cc8b", "103b9", "..", "745a4001", " ")).toBe("cc8b/745a4001")
  expect(pathJoin(" ", "    ", "test", "  ", "      ", " ")).toBe("test")

  expect(pathJoin(" ", ".", "52e7d94e", ".", "759g8bc4")).toBe(
    "52e7d94e/759g8bc4",
  )
})
