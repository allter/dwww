/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

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
		peers.push.apply( peers, keys( this.agent.neighbours ) );
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
	}
};

