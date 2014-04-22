var http = require("http"),
	https = require("https"),
	url = require("url"),
	net = require("net"),
	util = require("util"),
	fs = require("fs"),
	EventEmitter = require("events").EventEmitter,
	config = require("../config.js");

// # ProxyServer
// A server that handles all incoming HTTP/S requests.
function ProxyServer(options) {
	var me = this;

	// setup a http server for proxying requests
	this.httpProxy = http.createServer();
	this.httpProxy.on("request", function (request, response) {
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
			me.emit("error", arguments);
		});
	});

	// ## handleHttpConnect
	// Handles a [HTTP CONNECT](http://en.wikipedia.org/wiki/HTTP_tunnel#HTTP_CONNECT_tunneling) method request, for HTTP tunneling.
	// This allows us to tunnel HTTPS requests (confirmed for OSX proxy settings only).
	this.handleHttpConnect = function (request, socket, head) {
		// we are going to take over direct socket communication
		// so this going to get a bit low-level and verbose
		// this code was adapted from:
		// http://newspaint.wordpress.com/2012/11/05/node-js-http-and-https-proxy/

		// open new TCP socket connection
		var parsedUrl = url.parse("https://" + request.url),
			httpVersion = request.httpVersion,
			proxySocket = new net.Socket(),
			options = {
				host: parsedUrl.hostname,
				port: parsedUrl.port || 443,
				headers: request.headers
			};	

		proxySocket.connect(options, function () {
			me.emit("tunnelConnect");

			// write head to proxy socket
			proxySocket.write(head);

			// let the caller know connection was succesful
			socket.write("HTTP/" + httpVersion + "200 Connection established\r\n\r\n");
		});

		// relay data coming into the proxy socket onto the client
		proxySocket.on("data", function (chunk) {
			me.emit("tunnelDataIn", chunk);
			socket.write(chunk);
		});

		proxySocket.on("end", function () {
			me.emit("tunnelEndIn");
			socket.end();
		});

		// forward requests from the client to the proxy socket
		socket.on("data", function (chunk) {
			me.emit("tunnelDataOut", chunk);
			proxySocket.write(chunk);
		});

		socket.on("end", function () {
			me.emit("tunnelEndOut");
			proxySocket.end();
		});

		// error on the proxy socket
		proxySocket.on("error", function (err) {
			me.emit("error", err);
			socket.write("HTTP/" + httpVersion + "500 Connection error\r\n\r\n");
			socket.end();
		});

		// error on requesting socket
		socket.on("error", function (err) {
			me.emit("error", err);
			proxySocket.end();
		});
	};

	this.httpProxy.on("connect", function (request, socket, head) {
		me.emit("httpConnect", request, socket, head);
		me.handleHttpConnect(request, socket, head);
	});

	// ## getIp
	// Gets the IP of the given request.
	this.getIp = function (req) {
		var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
		return ip;
	};

	// ## blockRequest
	// Default handler for request that are not handled due to proxy access restrictions
	this.blockRequest = function (request, response) {
		response.writeHead(403, {
			"content-type": "text/plain",
			"cache-control": "no-cache, no-store"
		});

		response.end("Access denied");
	};

	this.blockRequestSocket = function (request, socket) {
		socket.write("HTTP/" + request.httpVersion + "403 Access denied\r\n\r\n");
		socket.end();
	};

	// ## siteIsBlacklisted
	// Executes `blacklistCb` on the first blacklist match.
	// blacklistCb(siteUrl, blacklistRegex)
	this.siteIsBlacklisted = function (siteUrl, blacklistCb) {
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

			if (site.regex.test(siteUrl) && totalMinutes >= siteStart && totalMinutes <= siteEnd) {
				blacklistCb(siteUrl, site.regex);
			}
		});
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

		// handle HTTP CONNECT for http tunnel (HTTPS) requests
		this.on("httpConnect", function (request, socket, head) {
			var ip = me.getIp(request);
			if (config.ipWhitelist.indexOf(ip) === -1) {
				me.emit("ipDenied", ip);
				me.blockRequestSocket(request, socket, head);
			}
		});
	}

	// block sites if specified in the site blacklist
	if (config.siteBlacklist) {
		this.httpProxy.on("request", function (request, response) {
			me.siteIsBlacklisted(request.url, function () {
				me.emit("siteDenied", siteUrl);
				me.blockRequest(request, response);
			});
		});

		this.on("httpConnect", function (request, socket, head) {
			me.siteIsBlacklisted(request.url, function (siteUrl, regex) {
				me.emit("siteDenied", siteUrl);
				me.blockRequestSocket(request, socket, head);
			});
		});
	}

	this.httpProxy.listen(config.httpPort);
}

util.inherits(ProxyServer, EventEmitter);

module.exports = {
	ProxyServer: ProxyServer
};
