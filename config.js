module.exports = {
	httpPort: 8081,
	httpsPort: 8082,
	ipWhitelist: [
		"127.0.0.1",
		"180.19.142.55"
	],
	siteBlacklist: [
		{
			regex: /reddit.com/,
			between: ["0:00", "0:01"]
		}
	]
};
