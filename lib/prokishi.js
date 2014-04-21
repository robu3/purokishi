var http = require("http"),
	https = require("https"),
	url = require("url"),
	net = require("net"),
	util = require("util"),
	EventEmitter = require("events").EventEmitter,
	config = require("../config.js");

// # ProxyServer
// A server that handles all incoming HTTP/S requests.
function ProxyServer(options) {
	var me = this;

	// setup a http server for proxying requests
	this.httpProxy = http.createServer();
	this.httpProxy.on("request", function (request, response) {
		//console.log("new request", request.url);
		me.emit("request", request, response);
		
		request.pause();

		// forward request onto destination server
		var proxyOpts = url.parse(request.url);
		proxyOpts.headers = request.headers;
		proxyOpts.method = request.method;
		proxyOpts.agent = false;

		var proxyReq = http.request(proxyOpts, function (proxyResponse) {
			proxyResponse.pause();
			response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
			proxyResponse.pipe(response);
			proxyResponse.resume();
		});

		request.pipe(proxyReq);
		request.resume();

		request.on("close", function () {
			me.emit("close");
		});

		request.on("error", function () {
			console.log("request error");
			me.emit("error", arguments);
		});
	});

	// ## getIp
	// Gets the IP of the given request.
	this.getIp = function (req) {
		var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
		return ip;
	};

	this.blockRequest = function (request, response) {
		response.writeHead(403, {
			"content-type": "text/plain",
			"cache-control": "no-cache, no-store"
		});

		response.end("Access denied");
	};


	// block invalid IPs if a whitelist was provided in the config
	if (config.ipWhitelist) {
		this.httpProxy.on("request", function (request, response) {
			var ip = me.getIp(request);
			if (config.ipWhitelist.indexOf(ip) === -1) {
				me.emit("ipDenied", ip, request, response);
				me.blockRequest(request, response);
			}
		});
	}

	// block sites if specified in the site blacklist
	if (config.siteBlacklist) {
		this.httpProxy.on("request", function (request, response) {
			var date = new Date(),
				totalMinutes = date.getHours() * 60 + date.getMinutes(),
				siteStartRaw,
				siteEndRaw,
				siteStart,
				siteEnd;

			config.siteBlacklist.map(function (site) {
				// format is: ["2:00", "12:00"]
				// use minutes from midnight for time range check
				siteStartRaw = site.between[0].split(":"),
				siteEndRaw = site.between[1].split(":"),
				siteStart = parseInt(siteStartRaw[0]) * 60 + parseInt(siteStartRaw[1]),
				siteEnd = parseInt(siteEndRaw[0]) * 60 + parseInt(siteEndRaw[1]);

				if (site.regex.test(request.url) && totalMinutes >= siteStart && totalMinutes <= siteEnd) {
					// inside the time range
					me.emit("siteDenied", request.url, request, response);
					me.blockRequest(request, response);
				}
			});
		});
	}

	this.httpProxy.listen(config.httpPort, function () {
	});
}

util.inherits(ProxyServer, EventEmitter);

module.exports = {
	ProxyServer: ProxyServer
};
