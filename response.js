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
	this.info = []; // name, value, type, class, source_id, trust, derived_from_id
	//this.query = []; // name, type, class
	//this.source_id = ''; // server's ID
}
DNSResponse.prototype = new Response();
DNSResponse.prototype.type = function () { return 'application/x-dns-response'; }

DNSResponse.prototype.add_query = function ( name, type, class )
{
	this.query = [ name, type, ( class || 'IN' ) ];
	return this; // Allows chaining
};
DNSResponse.prototype.q_type = function ( ) { return this.query[ 1 ]; }
DNSResponse.prototype.q_name = function ( ) { return this.query[ 0 ]; }
DNSResponse.prototype.q_class = function ( ) { return this.query[ 2 ]; }

DNSResponse.prototype.add_source_id = function ( source_id )
{
	this.source_id = source_id;
	return this; // Allows chaining
};
DNSResponse.prototype.add_info = function ( name, value, type, class, trust, derived_from_id )
{
	//                0     1      2
	this.info.push( [ name, value, type,
	//  3                  4                 5
		( class || 'IN' ), ( trust || 1 ), ( derived_from_id || this.source_id ) ] );
	this.status = 200;
	return this; // Allows chaining
};

// Accessors to this.info 'members'
DNSResponse.prototype.i_name = function ( id ) { return this.info[ id ][ 0 ]; }
DNSResponse.prototype.i_value = function ( id ) { return this.info[ id ][ 1 ]; }
DNSResponse.prototype.i_type = function ( id ) { return this.info[ id ][ 2 ]; }
DNSResponse.prototype.i_class = function ( id ) { return this.info[ id ][ 3 ]; }
DNSResponse.prototype.i_trust = function ( id ) { return this.info[ id ][ 4 ]; }
DNSResponse.prototype.i_derived_from_id = function ( id ) { return this.info[ id ][ 5 ]; }

DNSResponse.prototype.get_value = function ( type, fqdn )
{
//log( "t" + type + "f" + fqdn );
	for ( var i in this.info )
	{
//log( "<<<" + this.info[i][1] );
		if ( type == this.i_type( i ) && fqdn == this.i_name( i ) )
		{
//log( "---" );
			return this.i_value( i );
		}
	}
	return null;
};
DNSResponse.prototype.get_resolved_value = function ()
{
	if ( ! this.query || ! this.query[0] || ! this.query[1] )
		throw 'name and type must be set in query';

	return this.get_value( this.query[1], this.query[0] );
};
DNSResponse.prototype.get_resolved_trust = function ( base_trust )
{
	base_trust = base_trust || 1;
	if ( ! this.query || ! this.query[0] || ! this.query[1] )
		throw 'name and type must be set in query';

	for ( var i in this.info )
	{
//log( "<<<" + this.info[i][1] );
		if ( this.q_type() == this.i_type( i ) && this.q_name() == this.i_name( i ) )
		{
//log( "---" );
			var t = this.i_trust( i );
			return ( ( t > base_trust ) ? base_trust : t );
		}
	}
	return 0;
};
DNSResponse.prototype.dump = function ()
{
	var res = "";
	res += ";;source_id: " + this.source_id + "\n";
	if ( this.query )
		res += ";;QUESTION:\n;" + this.query[2] + "\t" + this.query[1] + "\t" + this.query[0] + "\n";
	for ( var i in this.info )
	{
		res += this.i_class( i ) + "\t" + this.i_type( i ) + "\t" + this.i_name( i ) + "\t" + this.i_value( i ) +
			"; trust:" + this.i_trust( i ) + ", from:" + this.i_derived_from_id( i ) +
			"\n";
	}
	return res;
}

