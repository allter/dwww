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

// Object dumper (not all implementation have .toSource)
function dump_object( object )
{
	var res = "{";
	var k = keys( object );
	for ( var i in k )
		res += k[i] + ":" + object[ k[i] ];
	res += "}";
	return res;
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
	schema: 'x-sha1hash',
	handle_request: function( args )
	{
		if ( this.agent.content[ args.sha1hash ] != null )
		{
			this.agent.log( "Returning object: " + this.schema + ":" + args.sha1hash );
			return new Response( this.agent.content[ args.sha1hash ], 200 );
		}

		this.agent.log( "Could not find object: " + this.schema + ":" + args.sha1hash );
		return new Response( null, 404 );
	},
	query_WWW: function ( method, url, args )
	{
		var parts = url.split( ':', 2 );
		if ( parts[0] != this.schema )
		{
			this.agent.log_error( 'Tried to process request for wrong schema ' + parts[0] );
			return new Response( null, 501 );
		}
		if ( method != 'GET' )
		{
			this.agent.log_error( 'Methods other than GET not supported' );
			return new Response( null, 501 );
		}

		// Simply call all peers starting from ourselves until we receive correct_answer
		var peers = [ this.agent.id ];
		peers.push.apply( peers, this.agent.neighbours );
		for ( var i in peers )
		{
			var response = this.agent.make_protocol_request(
				peers[i],
				this.schema,
				{ sha1hash: parts[1] }
			);
			if ( response.is_ok() )
				return response;
		}

		return new Response( null, 404 );
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
	make_protocol_request: function ( correspondent, protocol_schema, args )
	{
		this.log( "->" + correspondent + " " + protocol_schema + ": " + dump_object( args ) );

		// Doesn't handle FAILs
		try
		{
			var c = this.address_map[ correspondent ];
			if ( ! c.protocols[ protocol_schema ] )
			{
				this.log( "Correspondent " + correspondent + " doesn't support proto " + protocol_schema );
				return new Response( null, 501 );
			}

			var response = c.protocols[ protocol_schema ].handle_request( args );
			return response;
		}
		finally
		{
		}
	},
	SHOW: function ( url ) // Pseudo method callable by user, implements functionality of user-agent
	{
		this.log( "SHOW " + url );

		var response = this.query_WWW( 'GET', url );
		if ( response.is_ok() )
		{
			this.log( "[" + response.status + "] Showing object: <span style='color:green'>" + this.render_to_html( response ) + "</span>" );
			this.add_content( response.content );
			return;
		}

		// Give up
		this.log_error( "[" + response.status + "] Could not find object " + url );
	},
	query_WWW: function ( method, url, args )
	{
		var parts = url.split( ':', 2 );

		// Check if the protocol is supported
		if ( ! this.protocols[ parts[0] ] )
		{
			this.log_error( "Unsupported protocol: " + parts[0] );
			return new Response( null, 501 );
		}

		// Call protocols' method handler
		return this.protocols[ parts[0] ].query_WWW( method, url, args );
	},	
	render_to_html: function( response )
	{
		if ( response.type() == 'text/html' )
		{
			var html = response.content;
			var _this = this;
			html = html.replace( /<iframe\s+src\s*=\s*["]([^"]+)["]\s*[^>]*>/g, //"
				function ( str, p1 )
				{
					var response = _this.query_WWW( 'GET', p1 );
					if ( response.is_ok )
						return _this.render_to_html( response );
					return 'IFRAME INCLUSION FAILED: src=' + p1;
				}
			);
			html = html.replace( /<[^>]*>/g, '' );
			return html;
		}

		// Escape text/plain and other default junk type's content
		var content = response.content;
		content.replace( /[&]/g, '&amp;' );
		content.replace( /["]/g, '&quot;' ); //"
		content.replace( /</g, '&lt;' );
		content.replace( />/g, '&gt;' );
		return content;
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

