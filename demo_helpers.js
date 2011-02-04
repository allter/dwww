/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/

// Convenience function that is absent in ubiquituous JS
function keys( object )
{
	var a = [];
	for ( var i in object )
		a.push( i );
	return a;
}

// Object dumper (not all implementation have .toSource)
function dump_object( object )
{
	var res = "{";
	var k = keys( object );
	for ( var i in k )
		res += k[i] + ":" + object[ k[i] ]+",";
	res += "}";
	return res;
}

// Convenience logger
function log( msg_html )
{
	var log_element = $('#log');
	log_element.append( ( msg_html || '' ) + "<br/>" );
}
