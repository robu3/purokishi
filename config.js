module.exports = {
	httpPort: 8081,
	httpsPort: 8082,
	includeHttps: false,
	ipWhitelist: [
		"127.0.0.1"
	],
	siteBlacklist: [
		{
			regex: /reddit.com/,
			between: ["0:00", "10:01"]
		},
		{
			regex: /github.com/,
			between: ["0:00", "10:01"]
		}
	]
};
