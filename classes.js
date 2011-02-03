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
	type: function () // Returns MIME-type of received content
	{
		// TODO: correct checking and ability to specify type manually
		if ( this.is_error() )
			return null;
		if ( this.content.match( /^<html>/ ) )
		{
			return 'text/html';
		}

		return 'text/plain'; // Default
	},
	is_error: function () { return this.status != 200; },
	is_ok: function () { return ! this.is_error(); }
};

// class for x-sha1hash protocol handler
function Proto_sha1hash( agent )
{
	this.agent = agent;
}
Proto_sha1hash.prototype = {
	GET: function ( url )
	{
		var parts = url.split( ':', 2 );

		// Only the trivial protocol is supported
		if ( parts[0] != "x-sha1hash" )
		{
			this.log_error( "Unsupported protocol" );
			return new Response( null, 500 );
		}

		// Searching locally
		if ( this.agent.content[ parts[1] ] != null )
		{
			this.log( "Returning object: " + url );
			return new Response( this.agent.content[ parts[1] ], 200 );
		}

		this.log( "Could not find object: " + url );
		return new Response( null, 500 );
	},
	query_WWW: function ( method, url, args )
	{
		// Simply call all peers starting from ourselves until we receive correct_answer
		var peers = [ this.agent.id ];
		peers.push.apply( peers, this.agent.neighbours );
		for ( var i in peers )
		{
			var response = this.agent.msg( peers[i], method, url, args );
			if ( response.is_ok() )
				return response;
		}

		return new Response( null, 500 );
	},
};

// class Agent, simulates DWWW agents
function Agent( id, address_map, neighbours )
{
	this.id = id;
	this.address_map = address_map;
	this.neighbours = neighbours;
	this.content = {};
	this.protocols = {};
	this.protocols[ 'x-sha1hash' ] = new Proto_sha1hash( this );
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
	SHOW: function ( url ) // Pseudo method callable by user, implements functionality of user-agent
	{
		this.log( "SHOW " + url );
		var parts = url.split( ':', 2 );

		// Check if the protocol is supported
		if ( ! this.protocols[ parts[0] ] )
		{
			this.log_error( "Unsupported protocol: " + parts[0] );
			return;
		}

		var response = this.query_WWW( 'GET', url );
		if ( response.is_ok() )
		{
			this.log( "Showing object: <span style='color:green'>" + this.to_html( response ) + "</span>" );
			this.add_content( response.content );
			return;
		}

		// Give up
		this.log_error( "[" + response.status + "]Could not find object " + url );
	},
	query_WWW: function function ( method, url, args )
	{
		var parts = url.split( ':', 2 );

		// Check if the protocol is supported
		if ( ! this.protocols[ parts[0] ] )
		{
			this.log_error( "Unsupported protocol: " + parts[0] );
			return;
		}
		return this.protocols[ parts[0] ].query_WWW( method, url, args );
	},	
	to_html: function( response )
	{
		if ( response.type() == 'text/html' )
		{
			var html = response.content;
//this.log( 'here-- ' + html );
			var _this = this;
			html = html.replace( /<iframe\s+src\s*=\s*["]([^"]+)["]\s*[^>]*>/g, //"
				function ( str, p1 )
				{
					var response = _this.query_WWW( 'GET', p1 );
					if ( response.is_ok )
						return _this.to_html( response );
					return 'IFRAME INCLUSION FAILED: src=' + p1;
				}
			);
			html = html.replace( /<[^>]*>/g, '' );
			return html;
		}
//this.log( 'there--' );

		// Escape text/plain and other default junk type's content
		var content = response.content;
		content.replace( /[&]/g, '&amp;' );
		content.replace( /["]/g, '&quot;' ); //"
		content.replace( /</g, '&lt;' );
		content.replace( />/g, '&gt;' );
		return content;
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

