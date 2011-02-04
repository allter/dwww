/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// class for x-dwww protocol handler
function Proto_dwww( agent )
{
	this.agent = agent;
}
Proto_dwww.prototype = {
	schema: 'x-dwww',
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

		return new Response( null, 404 );
	},
};

