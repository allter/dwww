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

	  if ( ! uri.authority_is_address() ) // TODO: support address authorities too
	  {

		// Find URI to content
		var res_dns = this.agent.query_WWW( 'GET', 'x-dns:' + uri.authority + "?type=URI" );
		if ( res_dns.is_ok() )
		{
			var uri = res_dns.get_value( 'URI', uri.authority );
//this.agent.log( '---' );
			if ( ! uri ) return new Response( null, 404 );

			var res_uri = this.agent.query_WWW( method, uri );
			return res_uri;
		}

		// Check if address has simple addresses for x-direct
		res_dns = this.agent.query_WWW( 'GET', 'x-dns:' + uri.authority );
		if ( res_dns.is_ok() )
		{
			var x_direct_url = url.replace( /^x-dwww:/, 'x-direct:' );
			return this.agent.query_WWW( method, x_direct_url );
		}
	  }

		return new Response( null, 404 );
	},
};

