/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// class for x-dwww protocol handler
function Proto_dwww( agent )
{
	this.agent = agent;

	// dwww uses ddns, so add its protocol handler
	if ( ! this.agent.proto( 'x-ddns' ) )
	{
		this.agent.proto_add( 'x-ddns' );
	}
}
Proto_dwww.prototype = {
	schema: 'x-dwww',
	dns_schema: 'x-ddns',
	//dns_schema: 'x-dns',
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
//this.agent.log( this.schema + ':  searching for URI record' );
		var res_dns = this.agent.query_WWW( 'GET', this.dns_schema + ':' + uri.authority + "?type=URI" );
		if ( res_dns.is_ok() )
		{
			var uri = res_dns.get_value( 'URI', uri.authority );
//this.agent.log( '---' );
			if ( ! uri ) return new Response( null, 404 );

			var res_uri = this.agent.query_WWW( method, uri );
			return res_uri;
		}

		// Check if address has simple addresses for x-direct
//this.agent.log( this.schema + ': searching for A record' );
		res_dns = this.agent.query_WWW( 'GET', this.dns_schema + ':' + uri.authority );
//this.agent.log( '---: ' + this.dns_schema + ':' + uri.authority );
		if ( res_dns.is_ok() )
		{
//this.agent.log( this.schema + ': found A record: ' + res_dns.get_resolved_value() );
			var regexp = new RegExp( '^x-dwww://' + uri.authority );
//throw regexp + ' ' + 'x-direct:' + res_dns.get_resolved_value()
//this.agent.log( "regexp " + regexp + ", x-direct url prefix: " + 'x-direct://' + res_dns.get_resolved_value() );
			var x_direct_url = url.replace( regexp, 'x-direct://' + res_dns.get_resolved_value() );
//this.agent.log( this.schema + ': redirecting to x-direct url: ' + x_direct_url );
//throw 'AAA';
			return this.agent.query_WWW( method, x_direct_url );
		}
	  }

		return new Response( null, 404 );
	},
};

