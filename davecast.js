var myProductName = "davecast", myVersion = "0.4.7";  

/*  The MIT License (MIT)
	Copyright (c) 2014-2017 Dave Winer
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/

const utils = require ("daveutils");
const websocket = require ("nodejs-websocket"); 
const request = require ("request");
const fs = require ("fs");

exports.start = startup;
exports.getTimeline = getTimelineFromServer;
exports.getFeedlist = getListFromServer;
exports.getIconForMessage = getIconForMessage;
exports.simulateMessage = handleIncomingMessage;

var mySocket = undefined;
var feedlist = new Array ();
const maxTimeline = 100;
var timeline = new Array ();

var config = {
	urlHttpServer: "http://davecast.org/",
	urlWebsocketsServer: "ws://davecast.org:5381/",
	
	flSaveData: true, //if true we keep the timeline, feedlist and each message in a folder. 
	dataFolder: "data/",
	messagesFolder: "messages/",
	iconsFolder: "icons/",
	fnameTimeline: "timeline.json",
	fnameFeedlist: "feedlist.json",
	};

function httpReadUrl (url, callback) {
	request (url, function (error, response, data) {
		if (!error && (response.statusCode == 200)) {
			callback (data) 
			}
		else {
			callback (undefined);
			}
		});
	}
function downloadBigFile (url, f, pubDate, callback) { //4/17/17 by DW
	utils.sureFilePath (f, function () {
		var theStream = fs.createWriteStream (f);
		theStream.on ("finish", function () {
			if (pubDate === undefined) {
				pubDate = new Date ();
				}
			else {
				pubDate = new Date (pubDate);
				}
			fs.utimes (f, pubDate, pubDate, function () {
				});
			if (callback !== undefined) {
				callback ();
				}
			});
		request.get (url)
			.on ('error', function (err) {
				console.log (err);
				})
			.pipe (theStream);
		});
	}
function downloadFeedlistIcons () {
	function downloadOne (ixfeedlist) {
		var url = feedlist [ixfeedlist].urlIcon;
		var ext = utils.stringLower (utils.stringLastField (url, "."));
		var f = config.dataFolder + config.iconsFolder + utils.padWithZeros (ixfeedlist, 2) + "." + ext;
		feedlist [ixfeedlist].f = f; //for later use
		downloadBigFile (url, f);
		}
	for (var i = 0; i < feedlist.length; i++) {
		downloadOne (i);
		}
	}
function getListFromServer (callback) {
	var apiUrl = config.urlHttpServer + "davecast/feeds";
	httpReadUrl (apiUrl, function (jsontext) {
		var jstruct = undefined;
		try {
			jstruct = JSON.parse (jsontext);
			}
		catch (err) {
			console.log ("getListFromServer: err.message == " + err.message);
			}
		feedlist = jstruct;
		saveFeedlist (); //only saves if enabled
		if (callback !== undefined) {
			callback (jstruct);
			}
		downloadFeedlistIcons ();
		});
	}
function getTimelineFromServer (callback) {
	var apiUrl = config.urlHttpServer + "davecast/timeline";
	httpReadUrl (apiUrl, function (jsontext) {
		var jstruct = undefined;
		try {
			jstruct = JSON.parse (jsontext);
			}
		catch (err) {
			console.log ("getTimelineFromServer: err.message == " + err.message);
			}
		timeline = jstruct;
		saveTimeline ();
		if (callback !== undefined) {
			callback (jstruct);
			}
		});
	}
function consoleStatusMsg (s) {
	var theMessage = "\n" + myProductName + " v" + myVersion + ": ";
	if (s !== undefined) {
		theMessage += s
		}
	console.log (theMessage + ".");
	}
function saveMessage (jstruct, callback) { 
	if (config.flSaveData) {
		var f = config.dataFolder + config.messagesFolder + utils.getDatePath (jstruct.when) + jstruct.id + ".json";
		var jsontext = utils.jsonStringify (jstruct);
		utils.sureFilePath (f, function () {
			fs.writeFile (f, jsontext, function (err) {
				if (err) {
					console.log ("saveMessage: err.message == " + err.message);
					}
				if (callback !== undefined) {
					callback ();
					}
				});
			});
		}
	else {
		if (callback !== undefined) {
			callback ();
			}
		}
	}
function saveTimeline (callback) { 
	if (config.flSaveData) {
		var f = config.dataFolder + config.fnameTimeline;
		utils.sureFilePath (f, function () {
			fs.writeFile (f, utils.jsonStringify (timeline), function (err) {
				if (err) {
					console.log ("saveTimeline: err.message == " + err.message);
					}
				if (callback !== undefined) {
					callback ();
					}
				});
			});
		}
	else {
		if (callback !== undefined) {
			callback ();
			}
		}
	}
function saveFeedlist (callback) { 
	if (config.flSaveData) {
		var f = config.dataFolder + config.fnameFeedlist;
		utils.sureFilePath (f, function () {
			fs.writeFile (f, utils.jsonStringify (feedlist), function (err) {
				if (err) {
					console.log ("saveFeedlist: err.message == " + err.message);
					}
				if (callback !== undefined) {
					callback ();
					}
				});
			});
		}
	else {
		if (callback !== undefined) {
			callback ();
			}
		}
	}
function getIconForMessage (jstruct) {
	for (var i = 0; i < feedlist.length; i++) {
		var item = feedlist [i];
		if (item.urlFeed == jstruct.feedUrl) {
			return (item.f);
			}
		}
	return (undefined);
	}
function handleIncomingMessage (jstruct, callback) {
	timeline.unshift (jstruct);
	while (timeline.length > maxTimeline) {
		timeline.pop ();
		}
	saveTimeline ();
	saveMessage (jstruct);
	if (callback !== undefined) {
		callback (jstruct);
		}
	}

function startup (userConfig, callback) {
	var flEveryMinuteScheduled = false;
	function startWebSocketClient (s) {
		mySocket = websocket.connect (config.urlWebsocketsServer); 
		mySocket.on ("connect", function () {
			consoleStatusMsg ("connection opened with " + config.urlWebsocketsServer);
			mySocket.send (s);
			});
		mySocket.on ("text", function (eventData) {
			if (eventData !== undefined) { //no error
				var words = eventData.split (" ");
				if (words.length >= 2) { 
					switch (words [0]) {
						case "updated":
							var listname = utils.trimWhitespace (words [1]);
							if (listname == "feeds.json") {
								getListFromServer ();
								}
							break;
						case "readfeed":
							var urlfeed = utils.trimWhitespace (words [1]);
							break;
						case "item":
							var jsontext = utils.stringDelete (eventData, 1, 5); //pop off "item "
							var jstruct = JSON.parse (jsontext);
							handleIncomingMessage (jstruct, callback);
							break;
						default:
							break;
						}
					}
				}
			});
		mySocket.on ("close", function (code, reason) {
			mySocket = undefined;
			});
		mySocket.on ("error", function (err) {
			});
		}
	function everyMinute () {
		consoleStatusMsg (new Date ().toLocaleTimeString ());
		}
	function everySecond () {
		var now = new Date ();
		if (mySocket === undefined) { //try to open the connection
			startWebSocketClient ("hello world");
			}
		if (!flEveryMinuteScheduled) {
			if (now.getSeconds () == 0) {
				flEveryMinuteScheduled = true;
				setInterval (everyMinute, 60000); 
				everyMinute (); //do one right now
				}
			}
		}
	
	if (userConfig !== undefined) {
		for (x in userConfig) {
			config [x] = userConfig [x];
			}
			
		}
	
	getListFromServer (function () {
		getTimelineFromServer (function () {
			setInterval (everySecond, 1000); 
			});
		});
	}
