/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// Class for x-ddns protocol handler
function Proto_ddns ( agent )
{
	this.agent = agent;
	this.database = {}; // db.<type>.<fqdname>[ #record ][.value|.trust]
//	this.authorities = {}; // auth.<id>[ #attr ]
	this.cache = {}; // db.<id>.<type>.<fqdname>[ #record ][.value|.trust|.derived_from ]

	this.log_level = 1;

	// 
	this.peer_handlers = {};
	this.peer_handlers[ 'dns' ] = [ ]; // TODO

	// Default resolver settings
	this.add_record( 'NS', '.', 'sim.root-servers.net.', 0.8 )
	this.add_record( 'A', 'sim.root-servers.net.', 'DR1', 0.8 )

/*
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
*/
}
Proto_ddns.prototype = {
	schema: 'x-ddns',
	dns_schema: 'x-dns',
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
		// Low-level insertion of DNS record into local database
		trust = trust || 1;
		if ( ! this.database[ type ] )
			this.database[ type ] = {};
		if ( ! this.database[ type ][ fqdn ] )
			this.database[ type ][ fqdn ] = [];
		var old_records = this.database[ type ][ fqdn ];

		// Prepare record to add or replace
		var record = [ value, trust, ( agent_id || this.agent.id ) ];

		// Insert or replace record
		if ( old_records.length == 0 )
		{
			old_records.push( record );
		}
		else
		{
			// Check if current trust allows insertion or replacement
			var record_trust_is_bigger = false;
			var record_trust_is_equal = true;
			for ( var i in old_records )
			{
				if ( trust > old_records[i][1] )
					record_trust_is_bigger = true;
				if ( trust != old_records[i][1] )
					record_trust_is_equal = false;
			}

			// Actually insert or replace previous
			if ( record_trust_is_equal )
				old_records.push( record );
			if ( record_trust_is_bigger )
				this.database[ type ][ fqdn ] = [ record ];
		}
	},
	add_response: function ( response, base_trust )
	{
		base_trust = base_trust || 1;
		this.log( 'add_response: base_trust=' + base_trust + ', response=' + response.dump() );
		for ( var i in response.info )
		{
			this.add_record(
				response.i_type( i ),
				response.i_name( i ),
				response.i_value( i ),
				( ( response.i_trust( i ) > base_trust ) ?  base_trust : response.i_trust( i ) ),
				response.source_id
			);
		}
	},
	update_cache: function ( response )
	{
//		this.log( 'updating cache with response: : ' + response.dump() );
		if ( ! this.cache[ response.source_id ] )
			this.cache[ response.source_id ] = {};

		for ( var i in response.info )
		{
			var ri = response.info[ i ];
	
			if ( ! this.cache[ response.source_id ][ response.i_type( i ) ] )
				this.cache[ response.source_id ][ response.i_type( i ) ] = {};
			if ( ! this.cache[ response.source_id ][ response.i_type( i ) ][ response.i_name( i ) ] )
				this.cache[ response.source_id ][ response.i_type( i ) ][ response.i_name( i ) ] = [];
			this.cache[ response.source_id ][ response.i_type( i ) ][ response.i_name( i ) ].push(
				[ response.i_value( i ), response.i_trust( i ), response.i_derived_from_id( i ) ]
			);
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

		return this.query_ddns_recursive( type, dn );
	},
	query_local: function ( type, fqdn )
	{
this.log_level && this.log( "query_local: type=" + type + ", fqdn=" + fqdn );
		if ( ! this.database[ type ] ) return new Response( null, 404 );
		var values = this.database[ type ][ fqdn ];
		if ( !values || ! values.length ) return new Response( null, 404 );

		var response = new DNSResponse();
		response.add_query( fqdn, type, null );
		response.add_source_id( this.agent.id );
		for ( var i in values )
		{
this.log_level && this.log( "query_local: adding to response: " + "type=" + type + ", fqdn=" + fqdn + ", value=" + values[i][0] +
	", trust=" + values[i][1] + ", derived_from_id=" + values[i][2]
);
			response.add_info( fqdn, values[i][0], type, null, values[i][1], values[i][2] );
		}
		return response;
	},
	/*
	query_ddns_server: function ( type, dn, server )
	{
this.log_level && this.log( "query_ddns_server: type=" + type + ", fqdn=" + dn + ", srv=" + server );
		var res = this.agent.make_protocol_request( server, 'x-dns', { type: type, fqdn: dn } );
		if ( res.is_error() )
			return new Response( null, 404 );
		this.add_response( res );
		this.update_cache( res );
		return res;
	},
	*/
	query_dns_server: function ( type, dn, server, base_trust )
	{
this.log_level && this.log( "query_dns_server: type=" + type + ", fqdn=" + dn + ", srv=" + server );
		var res = this.agent.make_protocol_request( server, 'x-dns', { type: type, fqdn: dn } );
		if ( res.is_error() )
			return new Response( null, 404 );
		this.add_response( res, base_trust );
		this.update_cache( res );
		return res;
	},
	query_peers: function ( type, dn, base_trust ) // Perform query of peers and update local db
	{
		base_trust = base_trust || 1;
		// Simply call all peers starting from ourselves until we receive correct_answer
		var peers = keys( this.agent.neighbours ) || [];
		for ( var i in peers )
		{
			var response = this.agent.make_protocol_request(
				peers[i],
				this.dns_schema,
				{ type: type, fqdn: dn }
			);
			if ( response.is_error() ) continue;
			this.add_response( response, 1 ); // TODO: use individual peers' trust modifiers
			this.update_cache( response );
		}
		// Not returning anyithing check with query_local
	},
	query_dns_server_and_peers: function ( type, dn, server, base_trust )
	{
		base_trust = base_trust || 1;
		var dns_res = this.query_dns_server( type, dn, server, base_trust );
		this.query_peers( type, dn, base_trust );
		return this.query_local( type, dn );
		//return new Response( null, 404 );
	},
	query_ddns_recursive: function ( type, dn )
	{
		/*
		// First try to find direct record about dn
		var res_local_query = this.query_local( type, dn );
		if ( ! res_local_query.is_error() )
			return res_local_query;
		*/

		/*
			- we need to descend to root _always_ because spoofer can make fake subrecord (with lower trust)
				- maybe we should request data for all superdomains simultaneously and then add results
					to temporary local resolve DB?
				- it is possible to find as much delegation paths from root as possible, for systems with
					different trust degradation
			- what to do with records that are present only in default DNS
				(and thus, non-checkable by peers)?
					-> if they are the only, trust them. otherwise someone should have a copy derived from them
			- what to do with records for the same fqdn-type but with differrent trust?
				-> currently we just replace lower-trust record with higher-trust
			- what to do with records that are absent in the default DNS?
					-> someone should have record in the delegation tree,
						that is NXDOMAIN in the default DNS, but something different in someone's
						with trust value greater than NXDOMAIN's, then we use it
				- we should go with it if trust is > 0.5
					(what if not? how to deal with inherently untrusted p2p discovery?)
						-> trust is (in my system) only a metric of closeness to 'good' majority, with 1.0 being the metric of ourselves
							- it is possible that instead of trust we should use: 0 <= 'distrust' < infinity
		*/

		var dn_parts = dn.split( '.' );

/*
		// Find zone serving needed dn
		var l = dn_parts.length - 1;
		for ( var i = 0; i <= l; i++ )
		{
			var cur_parts = dn_parts.slice( i, l );
			var cur_dn = cur_parts.join( '.' ) + '.';
this.log( 'cur_dn=' + cur_dn );

			// Find domain NSs
			var res_peers_ns = this.query_peers( 'NS', cur_dn );
			if ( res_peers_ns.is_error() ) continue; // What todo with 410/404 NXDOMAINS???
*/
			// If success:
			// Get NS A/AAAAs
			// Consult these
			// Ascend to dn

		var l = dn_parts.length - 1;
		for ( var i = l - 1; i >= 0; i-- )
		{

			var cur_parts = dn_parts.slice( i, l );
			var cur_dn = cur_parts.join( '.' ) + '.';
			var zone_parts = dn_parts.slice( i + 1, l ); 
			var cur_zone = zone_parts.join( '.' ) + '.';
this.log( i + ": cur_dn: " + cur_dn + " , cur_zone: " + cur_zone );

			// load cur_zone NS from local cache
			var res_cur_zone_ns = this.query_local( 'NS', cur_zone );
			if ( res_cur_zone_ns.is_error() ) return new Response( null, 404 ); // TODO in ddns better continue;
			var result_trust = res_cur_zone_ns.get_resolved_trust();
this.log( res_cur_zone_ns.is_error() + ", cur_zone=" +
	cur_zone + ", value=" + res_cur_zone_ns.get_resolved_value() +
	", trust=" + result_trust +
	", dump=" + res_cur_zone_ns.dump() );

			// load cur_zone NS's A from local cache
			var res_cur_zone_a = this.query_local( 'A', res_cur_zone_ns.get_resolved_value() );
//this.log( res_cur_zone_a.is_error() + " " + res_cur_zone_a.dump() );
//this.log( '-' );
			if ( res_cur_zone_a.is_error() ) return new Response( null, 404 ); // TODO in ddns better continue;
			result_trust = res_cur_zone_a.get_resolved_trust( result_trust );
			zone_server_addr = res_cur_zone_a.get_resolved_value();
this.log( "zone_server_addr: " + zone_server_addr + ", result_trust: " + result_trust );

//this.log( '--- i: ' + i );
			if ( i != 0 )
			{
				// Load cur_dn zone NS record into local cache
				var res_cur_dn = this.query_local( 'NS', cur_dn );
				if ( res_cur_dn.is_error() )
					res_cur_dn = this.query_dns_server_and_peers( 'NS', cur_dn, zone_server_addr, result_trust );
				if ( res_cur_dn.is_error() )
					return new Response( null, 404 );
				result_trust = res_cur_dn.get_resolved_trust( result_trust );

				// Load cur_dn zone NS's A record into local cache
				var res_cur_dn_ns_a = this.query_local( 'A', res_cur_dn.get_resolved_value() );
				if ( res_cur_dn_ns_a.is_error() )
					res_cur_dn_ns_a = this.query_dns_server_and_peers( 'A', res_cur_dn.get_resolved_value(), zone_server_addr, result_trust );
				if ( res_cur_dn_ns_a.is_error() )
					return new Response( null, 404 );
			}
			else
			{
//this.log( '--- ' );
				var res_cur_dn = this.query_local( type, cur_dn );
//this.log( '---: ' + res_cur_dn.dump() );
				if ( res_cur_dn.is_error() )
					res_cur_dn = this.query_dns_server_and_peers( type, cur_dn, zone_server_addr, result_trust );
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
