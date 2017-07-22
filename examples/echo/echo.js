const davecast = require ("davecast");
const config = {
	incomingMessageCallback: function (jstruct) {
		console.log ("davecast message: " + JSON.stringify (jstruct, undefined, 4));
		}
	};
davecast.start (config);
