# Intro

This is a simple web crawler I plan to use for personal projects.

# Installation

```bash
npm install --save @jrc03c/web-crawler
```

# Usage

```js
const WebCrawler = require("@jrc03c/web-crawler")

const crawler = new WebCrawler({
  delay: 3000,
  filter: url => url.includes("example.com"),
  requestTimeout: 3000,
})

crawler.on("after-crawl", payload => {
  console.log("Just crawled: " + payload.url)
})

crawler.on("error", payload => {
  console.error("ERROR: " + payload.message)
})

crawler.start("https://example.com")
```

# API

## `WebCrawler(options)` (constructor)

The `WebCrawler` constructor can optionally accept a configuration object with these properties (all of which are optional):

- `delay` = see the [`delay`](#delay) property
- `filter` = see the [`filter`](#filter) property
- `requestTimeout` = see the [`requestTimeout`](#requestTimeout) property
- `shouldHonorBotRules` = see the [`shouldHonorBotRules`](#shouldHonorBotRules) property
- `shouldOnlyFollowSitemap` = see the [`shouldOnlyFollowSitemap`](#shouldOnlyFollowSitemap) property

### Class (static) properties

#### `DisallowReasons`

An object whose keys and values are strings representing reasons for which the crawling of a particular URL might be disallowed. It is defined as:

```js
{
  DISALLOWED_BY_BOT_RULES: "DISALLOWED_BY_BOT_RULES",
  DISALLOWED_BY_META_TAG: "DISALLOWED_BY_META_TAG",
  DISALLOWED_BY_RESPONSE_HEADER: "DISALLOWED_BY_RESPONSE_HEADER",
}
```

Where:

- "DISALLOWED_BY_BOT_RULES" = the URL was disallowed by a "robots.txt" rule
- "DISALLOWED_BY_META_TAG" = the URL was disallowed by a "noindex" `<meta>` tag in a response's HTML
- "DISALLOWED_BY_RESPONSE_HEADER" = the URL was disallowed by an "x-robots-tag" header in a response

### Instance properties

#### `delay`

A positive integer representing the time in milliseconds between fetch requests. The default is 3000.

#### `domainConfigs`

An object whose keys and values, respectively, are domain names and bot configuration objects. The default is an empty object. Configuration objects are instances of the [`RobotsConfig`](src/helpers/robots-config/index.js) class.

#### `filter`

A function that receives a URL and returns a boolean indicating whether or not the URL should be crawled (`true` = the URL should be crawled; `false` = the URL should _not_ be crawled). The function can be either synchronous or asynchronous. The default value is an asynchronous function that always returns `true`.

#### `frontier`

An array of strings representing URLs to be crawled. The default is an empty array.

#### `isCrawling`

A boolean indicating whether or not the crawler is currently in the process of crawling URLs in its `frontier`. The default is `false`.

#### `isPaused`

A boolean indicating whether or not the crawler is currently paused in the process of crawling. The default is `false`.

#### `requestTimeout`

A positive integer representing the time in milliseconds the crawler should wait for a response to a request before aborting the request.

#### `shouldHonorBotRules`

A boolean indicating whether or not the crawler should abide by rules listed in "robots.txt" files, "x-robots-tag" headers in responses, and/or "noindex" `<meta>` tags in responses HTMLs. The default is `true`.

#### `shouldOnlyFollowSitemap`

A boolean indicating whether or not the crawler should only crawl pages listed in a site's sitemap. The default is `true`.

#### `subscriptions`

An object whose keys and values, respectively, are strings representing event names and arrays of callback functions to be called in response to emissions of events with those names. The default is an empty object.

#### `visited`

An array of strings representing URLs that have already been crawled. The default is an empty array.

### Instance methods

#### `addUrlToFrontier(url : string, shouldSkipFilter : boolean)`

Attempts to add a URL to the `frontier`. Returns a boolean indicating whether or not the URL was added. If the given URL is already in the `frontier`, then the URL is not added, and `false` is returned. If the given URL is already in `visited`, then the URL is not added, and `false` is returned. The `shouldSkipFilter` parameter is a boolean indicating whether or not the `filter` function should be skipped. By default, it's `false`, meaning that the `filter` function _will_ be applied. If the `filter` function is applied, and if it returns `false`, then the URL is not added, and `false` is returned. If the URL passes all of the above hurdles, then it is added to the `frontier`, the "add-url" event is emitted, and `true` is returned.

#### `createDomainConfiguration(domain : string)`

Creates a new `RobotsConfig` instance for the given domain (based on the domain's "robots.txt" file, if it exists), and then fetches the list of URLs from the domain's sitemap(s) (if they exist) and adds them to the `frontier`. The configuration is stored in the instance's `domainConfigs` object, and then the configuration is returned.

#### `emit(eventName : string, payload : any)`

Emits an event with a given name, passing `payload` to each callback function in the array of callback functions corresponding to the event name in the instance's `subscriptions` object. Returns the `WebCrawler` instance.

#### `getDomainConfiguration(domain : string)`

Returns a `RobotsConfig` instance for a given domain either by pulling it from the instance's `domainConfigs` object (if it exists there) or by creating a new configuration via the `createDomainConfiguration` instance method.

#### `off(eventName : string, callback : function)`

Removes the given callback from the array of callback functions in the instance's `subscriptions` object for the given event name. Returns the `WebCrawler` instance.

#### `on(eventName : string, callback : function)`

Adds the given callback to the array of callback functions in the instance's `subscriptions` object for the given event name. Returns the `WebCrawler` instance.

#### `pause()`

Pauses the crawling process and emits the "pause" event. Returns the `WebCrawler` instance.

#### `removeUrlFromFrontier(url)`

Removes all instances of the URL from the `frontier`. Returns the `WebCrawler` instance.

#### `start(url : string)`

Starts the crawling process, using the given URL as the first (and probably only) URL in the `frontier`, and emits the "start" event. Returns the `WebCrawler` instance.

Once the crawling process begins, other events are fired in sequence for each URL to be crawled. They are:

- "skip-url"
- "filter-url"
- "disallow-url"
- "before-crawl"
- "fetch"
- "after-crawl"
- "error"

See the [Events](#events) documentation below for more information about these events.

#### `stop()`

Stops the crawling process completely and emits the "stop" event. Returns the `WebCrawler` instance.

### Events

#### `"add-url"`

Is emitted when a new URL is added to the `frontier`. The payload passed to callback functions is an object with these properties:

```js
{
  url: string,
}
```

#### `"after-crawl"`

Is emitted after a URL has been successfully crawled. The payload passed to callback functions is an object with these properties:

```js
{
  dom: object, // a JSDOM instance
  raw: string, // the raw response text
  response: object, // the response object
  url: string, // the URL that was crawled
}
```

See [the JSDOM docs](https://github.com/jsdom/jsdom) for more info.

#### `"before-crawl"`

Is emitted before a URL is crawled. The payload passed to callback functions is an object with these properties:

```js
{
  url: string,
}
```

#### `"disallow-url"`

Is emitted when a URL is prevented from being crawled by a "robots.txt" rule, an "x-robots-tag" header in a response, or a "noindex" `<meta>` tag in a response's HTML. The payload passed to callback functions is an object with these properties:

```js
{
  reason: string, // one of WebCrawler.DisallowReasons
  url: string,
}
```

#### `"error"`

Is emitted when an error is thrown (but then caught) during the crawling process. The payload passed to callback functions is an object with these properties:

```js
{
  message: string, // the error message
  response: object, // the response object
  url: string, // the URL being crawled when the error occurred
}
```

Note that the "response" property may not always be present. It is only attached to the payload when the error occurred in response to a `fetch` request.

#### `"fetch"`

Is emitted after a `fetch` quest succeeds and a response is returned. The payload passed to callback functions is an object with these properties:

```js
{
  raw: string, // the raw response text
  response: object, // the response object
  url: string,
}
```

#### `"filter-url"`

Is emitted when an object fails to pass the `filter` function. The payload passed to callback functions is an object with these properties:

```js
{
  url: string,
}
```

#### `"finish"`

Is emitted once all URLs in the `frontier` have been crawled and there is nothing left to do. No payload is passed to callback functions.

#### `"pause"`

Is emitted in response to an invocation of the `pause` instance method. No payload is passed to callback functions.

#### `"skip-url"`

Is emitted when a URL is skipped because it already exists in `visited`. The payload passed to callback functions is an object with these properties:

```js
{
  url: string,
}
```

#### `"start"`

Is emitted in response to an invocation of the `start` instance method. No payload is passed to callback functions.

#### `"stop"`

Is emitted in response to an invocation of the `stop` instance method. No payload is passed to callback functions.

#### `"warn"`

Is emitted when the crawler wants to warn the user about something even though no error was thrown.

Currently, it is only emitted during the `createDomainConfiguration` instance method if no "robots.txt" file was found for a given domain. The payload passed to callback functions is an object with these properties:

```js
{
  domain: string, // the domain for which no "robots.txt" file was found
  message: string, // the warning message
}
```
