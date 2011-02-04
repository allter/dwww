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

