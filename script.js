function hello( frame_names )
{
	//alert( frames[ frame_names[0] ] );
	//alert( document.getElementById( 'src' ) );
	window.alert('hello: 42');
	for ( i in frame_names )
	{
		// TODO: understand JQuery
		$('#area').append( $('#sample').attr( 'id', frame_names[i] ).html() );
	}
	//$('#f1').attr('style', 'color:red');
}
