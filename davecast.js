var myProductName = "davecast", myVersion = "0.4.1";  

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

var mySocket = undefined;
var feedlist = new Array ();
const maxTimeline = 100;
var timeline = new Array ();

var config = {
	urlHttpServer: "http://davecast.org/",
	urlWebsocketsServer: "ws://davecast.org:5381/",
	flSaveMessages: true,
	messagesFolder: "data/messages/",
	flSaveTimeline: true,
	timelinePath: "data/timeline.json",
	flSaveFeedlist: true,
	feedlistPath: "data/feedlist.json"
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
		callback (jstruct);
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
		callback (jstruct);
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
	if (config.flSaveMessages) {
		var f = config.messagesFolder + utils.getDatePath (jstruct.when) + jstruct.id + ".json", jsontext = utils.jsonStringify (jstruct);
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
	if (config.flSaveTimeline) {
		utils.sureFilePath (config.timelinePath, function () {
			fs.writeFile (config.timelinePath, utils.jsonStringify (timeline), function (err) {
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
	if (config.flSaveFeedlist) {
		utils.sureFilePath (config.feedlistPath, function () {
			fs.writeFile (config.feedlistPath, utils.jsonStringify (feedlist), function (err) {
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

function startup (userConfig, callback) {
	var flEveryMinuteScheduled = false;
	function docallback (jstruct) {
		saveMessage (jstruct);
		if (callback !== undefined) {
			callback (jstruct);
			}
		}
	function startWebSocketClient (s) {
		mySocket = websocket.connect (config.urlWebsocketsServer); 
		mySocket.on ("connect", function () {
			consoleStatusMsg ("connection opened with " + config.urlWebsocketsServer);
			mySocket.send (s);
			});
		mySocket.on ("text", function (eventData) {
			if (eventData !== undefined) { //no error
				var words = eventData.split (" ");
				console.log ("startWebSocketClient: received message == " + eventData);
				if (words.length >= 2) { 
					switch (words [0]) {
						case "updated":
							var listname = utils.trimWhitespace (words [1]);
							if (listname == "feeds.json") {
								getListFromServer (function (theList) {
									feedlist = theList;
									saveFeedlist ();
									});
								}
							break;
						case "readfeed":
							var urlfeed = utils.trimWhitespace (words [1]);
							break;
						case "item":
							var jsontext = utils.stringDelete (eventData, 1, 5); //pop off "item "
							var jstruct = JSON.parse (jsontext);
							timeline.unshift (jstruct);
							while (timeline.length > maxTimeline) {
								timeline.pop ();
								}
							saveTimeline ();
							docallback (jstruct);
							break;
						default:
							console.log (words [0] + words [1]);
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
	
	getListFromServer (function (theList) {
		feedlist = theList; saveFeedlist ();
		getTimelineFromServer (function (theTimeline) {
			timeline = theTimeline; saveTimeline ();
			setInterval (everySecond, 1000); 
			});
		});
	}
