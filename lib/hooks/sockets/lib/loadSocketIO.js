module.exports = function (sails) {

	/**
	 * Module dependencies.
	 */

	var		util			= require( 'sails-util'),
			SocketServer	= require('socket.io'),
			Socket			= {
				authorization	: require('./authorization')(sails),
				connection		: require('./connection')(sails)
			};


	/**
	 * loadSocketIO()
	 * @param {Function} cb
	 *
	 * Prepare the nascent ws:// server (but don't listen for connections yet)
	 */

	return function loadSocketIO (cb) {
		sails.log.verbose('Configuring socket (ws://) server...');

		var socketConfig = sails.config.sockets;

		// Socket.io server (WebSockets+polyfill to support Flash sockets, AJAX long polling, etc.)
		var io = sails.io = sails.ws = 
		SocketServer.listen(sails.hooks.http.server, {
			logger: {
				info: function (){}
			}
		});

		// If logger option not set, use the default Sails logger config
		if (!socketConfig.logger) {
			var logLevels = {
				'silent': 0,
				'error': 1,
				'warn': 2,
				'debug': 4, // Socket.io flips these around (and it considers debug more verbose than `info`)
				'info': 3,	// Socket.io flips these around
				'verbose': 4	// Socket.io has no concept of `verbose`
			};
			io.set('log level', logLevels[sails.config.log.level] || logLevels['info']);
			io.set('logger', {
				error: sails.log.error,
				warn: sails.log.warn,
				info: sails.log.verbose,
				debug: sails.log.verbose // socket.io considers `debug` the most verbose config, so we'll use verbose to represent it
			});
		}



		// Process the Config File
		util.each(socketConfig, function(value, propertyName) {

			// Load the appropriate socketadapter module, and pass in the configuration information
			if (propertyName === 'adapter') {
				require("sails-socketadapter-"+value)(sails.config, io);
				return;
			}

			// Configure logic to be run before allowing sockets to connect
			if (propertyName === 'authorization') {

				// Custom logic
				if (util.isFunction(value)) {
					io.set('authorization', value);
					return;
				}

				// `authorization: true` means go ahead and use the default behavior
				if (value === true) {
					io.set('authorization', Socket.authorization);
					return;
				}

				// Otherwise skip the authorization step
				io.set('authorization', false);

				return;
			}

			// If value is explicitly undefined, do nothing
			if (util.isUndefined(value)) return;

			// In the general case, pass the configuration straight down to socket.io
			io.set(propertyName, value);

		});


		// For later:
		// io.configure('development', function() {});
		// io.configure('production', function() {});


		// Link Socket.io requests to a controller/action
		// When a socket.io client connects, listen for the actions in the routing table
		// Authorization has already passed at this point!
		io.sockets.on('connection', Socket.connection);

		cb && cb();
	};

};
