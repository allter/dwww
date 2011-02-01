/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// Convenience function that is absent in ubiquituous JS
function keys( object )
{
	var a = [];
	for ( var i in object )
		a.push( i );
	return a;
}

// Convenience logger
function log( msg_html )
{
	var log_element = $('#log');
	log_element.append( ( msg_html || '' ) + "<br/>" );
}

// class of Response, a convention for DWWW method responses
function Response( content, status )
{
	this.content = content;
	this.status = status || ( content != null && content != undefined ? 200 : 500 );
	this.attrs = {};
}
Response.prototype = {
	is_error: function () { return this.status != 200; },
	is_ok: function () { return ! this.is_error(); }
};

// class Agent, simulates DWWW agents
function Agent( id, address_map, neighbours )
{
	this.id = id;
	this.address_map = address_map;
	this.neighbours = neighbours;
	this.content = {};
}
Agent.prototype = {
	msg: function ( correspondent, method_string, url, args )
	{
		this.log( "->" + correspondent + " " + method_string + " " + url );
		if ( method_string != "GET" )
		{
			this.log_error( "Unsupported method " + method_string );
			throw "Unsupported method string" + method_string;
		}

		// Doesn't handle FAILs
		try
		{
			var response = this.address_map[ correspondent ][ method_string]( url, args );
			return response;
		}
		finally
		{
		}
	},
	SHOW: function ( url ) // Pseudo method callable by user
	{
		this.log( "SHOW " + url );
		var parts = url.split( ':', 2 );

		// Only the trivial protocol is supported
		if ( parts[0] != "x-sha1hash" )
		{
			this.log_error( "Unsupported protocol" );
			return;
		}

		// Simply call all peers starting from ourselves
		var peers = [ this.id ];
		peers.push.apply( peers, this.neighbours );
		for ( var i in peers )
		{
			var response = this.msg( peers[i], 'GET', url );
			if ( response.is_ok() )
			{
				this.log( "Showing object: <span style='color:green'>" + response.content + "</span>" );
				this.add_content( response.content );
				return;
			}
		}

		// Give up
		this.log_error( "Could not find object " + url );
	},
	GET: function ( url )
	{
		//this.log( "GET " + url );
		var parts = url.split( ':', 2 );

		// Only the trivial protocol is supported
		if ( parts[0] != "x-sha1hash" )
		{
			this.log_error( "Unsupported protocol" );
			return new Response( null, 500 );
		}

		// Searching locally
		if ( this.content[ parts[1] ] != null )
		{
			this.log( "Returning object: " + url );
			return new Response( this.content[ parts[1] ], 200 );
		}

		this.log( "Could not find object: " + url );
		return new Response( null, 500 );
	},
	add_content: function ( content )
	{
		this.content[ sha1Hash( content ) ] = content;
	},
	dump: function ()
	{
		this.log( 'dump: neighbours: ' + this.neighbours.join( ',' ) );
		this.log( 'dump: content: ' + keys( this.content ).join( ',' ) );
	},
	log_error: function( msg_html )
	{
		return this.log( '<span class="error_msg">' + msg_html + '</span>' );
	},
	log: function ( msg_html )
	{
		log( "<b>" + this.id + "</b>" + ": " + ( msg_html || '' ) );
	}
};

function hello( frame_names )
{
	//alert( frames[ frame_names[0] ] );
	//alert( document.getElementById( 'src' ) );

	// Simulates abstract mapping from scalar address space to objects
	var address_map = {
	};

	// Populate address space
	address_map[1] = new Agent( 1, address_map, [ 2 ] );
	address_map[1].dump();
	address_map[2] = new Agent( 2, address_map, [ 1 ] );
	address_map[2].add_content( 'Hello, world' );
	address_map[2].dump();

	log( '--- Playing with 2' );
	address_map[2].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );
	address_map[2].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc9" );

	log( '--- Playing with 1' );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc9" );

	log( '--- Hit using 1' );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );

	//window.alert('hello: 42');

/*
	for ( i in frame_names )
	{
		// TODO: understand JQuery
		$('#area').append( $('#sample').attr( 'id', frame_names[i] ).html() );
	}
*/
	//$('#f1').attr('style', 'color:red');
}
