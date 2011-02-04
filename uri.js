/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

function URI ( uri )
{
	if ( uri )
		this.parse_uri( uri );
/*
	Dynamic members:
	this.uri_original
	this.schema
	this.authority
	this.path
	this.segment_id
	this.query_string
	this.query_object
*/
};
URI.prototype = {
	parse_uri: function ( uri )
	{
		this.uri_original = uri;

		// Get schema
		var parts = uri.split( ':', 2 );
		var schema_specific;
		if ( parts[1] != '' )
		{
			this.schema = parts[0];
			schema_specific = parts[1];
		}
		else
		{
			this.schema = null;
			schema_specific = parts[0];
		}

		// Get segment_id
		var partsh = schema_specific.split( '#', 2 );
		var actual_uri = partsh[0];
		if ( partsh[1] != '' )
			this.segment_id = partsh[1]; /// TODOOO

		// Get query string
		var partq = actual_uri.split( '?', 2 );
		var endpoint = partq[0];
		this.query_string = partq[1];

		// Get path and authority
		var parts1 = endpoint.split( '//', 2 );
		if ( parts1[0] == '' )
		{
			var parts2 = parts1[1].split( '/', 2 );
			this.authority = parts2[0];
			this.path = '/' + parts2[1];
		}
		else
		{
			this.authority = null;
			this.path = parts1[0];
		}

		// Split query_string into object
		if ( this.query_string )
		{
			var q_o = {};
			var q_parts = this.query_string.split( '&' );
			for ( var i in q_parts )
			{
				var v_parts = q_parts[i].split( '=', 2 );
				q_o[ v_parts[0] ] = v_parts[1];
			}
			this.query_object = q_o;
		}
	}
};
