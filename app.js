var prokishi = require("./index"),
	proxy;

proxy = new prokishi.ProxyServer();

var events = [
	"request",
	"close",
	"error"
];

/*
// bind to all specified events
events.map(function (evt) {
	proxy.on(evt, function () {
		console.log("handled `" + evt + "`");
	});
});
*/

proxy.on("ipDenied", function (ip) {
	console.log("ip address denied: " + ip);
});

proxy.on("siteDenied", function (url) {
	console.log("siteDenied: ", url);
});

proxy.on("error", function (err) {
	console.log("ERROR: ", err);
});

proxy.on("httpConnect", function (req) {
	console.log("new HTTP CONNECT request: " + req.url);
});
