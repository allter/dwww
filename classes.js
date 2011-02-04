/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

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
	is_ok: function () { return ! this.is_error(); },
	dump: function ()
	{
		if ( this.is_error )
			return "[ERROR RESPONSE status=[" + this.status + "]]";

		var content = this.content;
		content.replace( /[&]/g, '&amp;' );
		content.replace( /["]/g, '&quot;' ); //"
		content.replace( /</g, '&lt;' );
		content.replace( />/g, '&gt;' );
		return content;
	}
};

function DNSResponse ()
{
	this.info = [];
}
DNSResponse.prototype = new Response();
DNSResponse.prototype.type = function () { return 'application/x-dns-response'; }
DNSResponse.prototype.add_info = function ( name, value, type, class )
{
	//                0     1      2
	this.info.push( [ name, value, type, ( class || 'IN' ) ] );
	this.status = 200;
	return this; // Allows chaining
};
DNSResponse.prototype.get_value = function ( type, fqdn )
{
//log( "t" + type + "f" + fqdn );
	for ( var i in this.info )
	{
//log( "<<<" + this.info[i][1] );
		if ( type == this.info[ i ][ 2 ]
			&& fqdn == this.info[ i ][ 0 ] )
		{
//log( "---" );
			return this.info[ i ][ 1 ];
		}
	}
	return null;
};
DNSResponse.prototype.dump = function ()
{
	var res = "";
	for ( var i in this.info )
	{
		var i = this.info[ i ];
		res += i[3] + "\t" + i[2] + "\t" + i[0] + "\t" + i[1] + "\n";
	}
	return res;
}

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
		var values = this.database[ type ][ fqdn ];
		if ( !values || ! values.length ) return new Response( null, 404 );

		var response = new DNSResponse();
		for ( var i in values )
		{
//this.log( fqdn + "-" + values[i][0] + "-" + type );
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

// class Agent, simulates DWWW agents
function Agent( id, address_map, neighbours )
{
	this.id = id;
	this.address_map = address_map;
	this.neighbours = neighbours;
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

