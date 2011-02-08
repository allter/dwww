/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// class Agent, simulates DWWW agents
function Agent( id, address_map, neighbours )
{
	this.id = id;
	this.address_map = address_map;

	this.neighbours = {};
	for ( var i in neighbours )
	{
		this.neighbours[ neighbours[ i ] ] = {};
	}

	this.content = {};
	this.protocols = {};
	this.protocols[ 'x-sha1hash' ] = new Proto_sha1hash( this );
	this.protocols[ 'x-dns' ] = new Proto_dns( this );
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
	proto: function ( schema ) { return this.protocols[ schema ]; },
	proto_add: function ( schema, proto ) { this.protocols[ schema ] = proto; },
	SHOW: function ( url ) // Pseudo method callable by user, implements functionality of user-agent
	{
		this.log( "SHOW " + url );

		var response = this.query_WWW( 'GET', url );
		if ( response.is_ok() )
		{
			this.log( "[" + response.status + "] Showing object " + url + ": <span style='color:green'>" + this.render_to_html( response ) + "</span>" );
			this.add_content( response.content );
			return;
		}

		// Give up
		this.log_error( "[" + response.status + "] Could not find object " + url );
	},
	query_WWW: function ( method, url, args )
	{
//this.log( 'q_W method=' + method + ", url=" + url );
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
		else if ( response.type() == 'application/x-dns-response' )
		{
			return "<pre>" + response.dump() + "</pre>";
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
		this.log( 'dump: neighbours: ' + keys( this.neighbours ).join( ',' ) );
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

