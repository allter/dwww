/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// Class for x-dns protocol handler
function Proto_dns ( agent )
{
	this.agent = agent;
	this.database = {}; // db.<type>.<fqdname>[ #record ].value|.trust
//	this.authorities = {}; // auth.<id>[ #attr ]

	// Default resolver settings
	this.add_record( 'NS', '.', 'sim.root-servers.net.', 0.8 )
	this.add_record( 'A', 'sim.root-servers.net.', 'DR1', 0.8 )

	// Authority resolver settings for . holder
	if ( agent.id == 'DR1' )
	{
		this.add_record( 'NS', 'tld.', 'ns.tld.', 1 );
		this.add_record( 'A', 'ns.tld.', 'DR2', 1 );
	}

	// Authority resolver settings for .tld holder
	if ( agent.id == 'DR2' )
	{
		this.add_record( 'A', 'vasya.tld.', '3', 1 );
		this.add_record( 'A', 'ns.tld.', 'DR2', 1 );
		this.add_record( 'A', 'vasya2.tld.', '2', 1 );
		this.add_record( 'URI', 'vasya3.tld.', 'x-direct://vasya.tld./index.txt', 1 );
	}
}
Proto_dns.prototype = {
	schema: 'x-dns',
/*	add_auth: function ( id )
	{
		this.authorities[ id ] = {};
	},
*/
	log: function ( msg )
	{
		this.agent.log( this.schema + ": " + msg );
	},
	add_record: function ( type, fqdn, value, trust, agent_id )
	{
		if ( ! this.database[ type ] )
			this.database[ type ] = {};
		if ( ! this.database[ type ][ fqdn ] )
			this.database[ type ][ fqdn ] = [];
		this.database[ type ][ fqdn ].push( [ value, ( trust || 1 ), ( agent_id || this.agent.id ) ] );
	},
	add_response: function ( response, peer_id )
	{
		this.log( 'adding record: ' + response.dump() );
		for ( var i in response.info )
		{
			var ri = response.info[ i ];
			this.add_record( ri[2], ri[0], ri[1], null, peer_id );
		}
	},
	handle_request: function ( args )
	{
		var res = this.query_local( args.type, args.fqdn );
		return res;
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

		// Parse query parameters
		var parts1 = parts[1].split( '?', 2 );
		var dn = parts1[0];
		var type;
		var class = 'IN';
		if ( parts1[1] )
		{
			var parts2 = parts1[1].split( '&' );
			for ( var i in parts2 )
			{
				var parts3 = parts2[i].split( '=' );
				if ( parts3[0] == 'type' )
					type = parts3[1];
			}
		}
		if ( ! type ) type = 'A';

		return this.query_dns_recursive( type, dn );
	},
	query_local: function ( type, fqdn )
	{
this.log( "query_local: type=" + type + ", fqdn=" + fqdn );
		if ( ! this.database[ type ] ) return new Response( null, 404 );
		var values = this.database[ type ][ fqdn ];
		if ( !values || ! values.length ) return new Response( null, 404 );

		var response = new DNSResponse();
		for ( var i in values )
		{
this.log( "query_local: adding to response: " + "type=" + type + ", fqdn=" + fqdn + ", value=" + values[i][0] );
			response.add_info( fqdn, values[i][0], type );
		}
		return response;
	},
	query_dns_server: function ( type, dn, server )
	{
this.log( "query_dns_server: type=" + type + ", fqdn=" + dn + ", srv=" + server );
		var res = this.agent.make_protocol_request( server, this.schema, { type: type, fqdn: dn } );
		if ( res.is_error() )
			return new Response( null, 404 );
		this.add_response( res, server );
		return res;
	},
	query_dns_recursive: function ( type, dn )
	{
		var dn_parts = dn.split( '.' );
//alert( dn_parts.toSource() );
//this.log( dn_parts.length );
		var l = dn_parts.length - 1;
		for ( var i = l - 1; i >= 0; i-- )
		{
			var cur_parts = dn_parts.slice( i, l );
			var cur_dn = cur_parts.join( '.' ) + '.';
			var zone_parts = dn_parts.slice( i + 1, l ); 
			var cur_zone = zone_parts.join( '.' ) + '.';
//this.log( i + ": cur_dn: " + cur_dn + " , cur_zone: " + cur_zone );

			// load cur_zone NS from local cache
			var res_cur_zone_ns = this.query_local( 'NS', cur_zone );
			if ( res_cur_zone_ns.is_error() ) return new Response( null, 404 );
//this.log( res_cur_zone_ns.is_error() + " " + cur_zone + " " + res_cur_zone_ns.get_value( 'NS', cur_zone ) + res_cur_zone_ns.dump() );

			// load cur_zone NS's A from local cache
			var res_cur_zone_a = this.query_local( 'A', res_cur_zone_ns.get_value( 'NS', cur_zone ) );
//this.log( res_cur_zone_a.is_error() + " " + res_cur_zone_a.dump() );
//this.log( '-' );
			if ( res_cur_zone_a.is_error() ) return new Response( null, 404 );
			zone_server_addr = res_cur_zone_a.get_value( 'A', res_cur_zone_ns.get_value( 'NS', cur_zone ) );
//this.log( "zone_server_addr: " + zone_server_addr );

//this.log( '--- i: ' + i );
			if ( i != 0 )
			{
				// Load cur_dn zone NS record into local cache
				var res_cur_dn = this.query_local( 'NS', cur_dn );
				if ( res_cur_dn.is_error() )
					res_cur_dn = this.query_dns_server( 'NS', cur_dn, zone_server_addr );
				if ( res_cur_dn.is_error() )
					return new Response( null, 404 );

				// Load cur_dn zone NS's A record into local cache
				var res_cur_dn_ns_a = this.query_local( 'A', res_cur_dn.get_value( 'NS', cur_dn ) );
				if ( res_cur_dn_ns_a.is_error() )
					res_cur_dn_ns_a = this.query_dns_server( 'A', res_cur_dn.get_value( 'NS', cur_dn ), zone_server_addr );
				if ( res_cur_dn_ns_a.is_error() )
					return new Response( null, 404 );
			}
			else
			{
//this.log( '--- ' );
				var res_cur_dn = this.query_local( type, cur_dn );
//this.log( '---: ' + res_cur_dn.dump() );
				if ( res_cur_dn.is_error() )
					res_cur_dn = this.query_dns_server( type, cur_dn, zone_server_addr );
//this.log( '---: ' + res_cur_dn.dump() );
				if ( res_cur_dn.is_error() )
					return new Response( null, 404 );

				// Return succesfull result
				return res_cur_dn;
			}
		}		

		//return new DNSResponse().add_info( 'vasya.root.', 'A', 1 );
		return new Response( null, 404 );		
	}
};
