/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// x-direct protocol is simulation of http/https for the purpose of simulating existing WWW infrastructure

// class for x-direct protocol handler
function Proto_direct( agent )
{
	this.agent = agent;
	this.document_root = {};
}
Proto_direct.prototype = {
	schema: 'x-direct',
	log: function ( msg )
	{
		this.agent.log( this.schema + ": " + msg );
	},
	log_error: function ( msg )
	{
		this.agent.log_error( this.schema + ": " + msg );
	},
	add_document: function ( path, document, mime_type )
	{
		// TODO support mime-types
		this.document_root[ path ] = document;
	},
	handle_request: function ( args )
	{
		var uri = new URI( args.url );
this.log( uri.path );
		if ( this.document_root[ uri.path ] )
			return new Response( this.document_root[ uri.path ], 200 );
		return new Response( null, 404 );
	},
	query_WWW: function ( method, url, args )
	{
		var uri = new URI( url );
		if ( uri.schema != this.schema )
		{
			this.agent.log_error( 'Tried to process request for wrong schema ' + uri.schema );
			return new Response( null, 501 );
		}
		if ( method != 'GET' )
		{
			this.agent.log_error( 'Methods other than GET not supported' );
			return new Response( null, 501 );
		}

		if ( ! uri.authority )
		{
			this.agent.log_error( 'This protocol requires authority' );
			return new Response( null, 501 );
		}

		var res = this.agent.make_protocol_request( uri.authority, this.schema, { method: method, url: url } );
		return res;
		
/*
		// Find URI to content
		var res_dns = this.agent.query_WWW( 'GET', 'x-dns:' + parts[1] + "?type=URI" );
		if ( res_dns.is_ok() )
		{
			var uri = res_dns.get_value( 'URI', parts[1] );
//this.agent.log( '---' );
			if ( ! uri ) return new Response( null, 404 );

			var res_uri = this.agent.query_WWW( method, uri );
			return res_uri;
		}
*/

		return new Response( null, 404 );
	},
};

