/*
	Licensed using GNU GPL terms
	(c) 2010, Andrey Smirnov
	TODO: proper (c) boilerplate
*/


function hello( frame_names )
{
	//alert( frames[ frame_names[0] ] );
	//alert( document.getElementById( 'src' ) );

	// Simulates abstract mapping from scalar address space to objects
	var address_map = {
	};

	// Populate address space
	address_map[1] = new Agent( 1, address_map, [ 2 ] );
	address_map[1].dump();
	address_map[2] = new Agent( 2, address_map, [ 1 ] );
	address_map[2].add_content( 'Hello, world' );
	address_map[2].dump();

	log( '--- Playing with 2' );
	address_map[2].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );
	address_map[2].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc9" );

	log( '--- Playing with 1' );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc9" );

	log( '--- Hit using 1' );
	address_map[1].SHOW( "x-sha1hash:e02aa1b106d5c7c6a98def2b13005d5b84fd8dc8" );

	//window.alert('hello: 42');

/*
	for ( i in frame_names )
	{
		// TODO: understand JQuery
		$('#area').append( $('#sample').attr( 'id', frame_names[i] ).html() );
	}
*/
	//$('#f1').attr('style', 'color:red');
}
