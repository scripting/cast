const davecast = require ("davecast");
const config = {
	};
davecast.start (config, function (jstruct) {
	console.log ("davecast message: " + JSON.stringify (jstruct, undefined, 4));
	});
