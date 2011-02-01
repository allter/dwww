function Agent( id )
{
	this.id = id;
}
Agent.prototype = {
	log: function ( msg_html )
	{
		var log_element = $('#log');
		log_element.append( "<b>" + this.id + "</b>" + ": " + ( msg_html || '' ) );
	}
};

function hello( frame_names )
{
	//alert( frames[ frame_names[0] ] );
	//alert( document.getElementById( 'src' ) );

	var a1 = new Agent( 1 );
	a1.log();

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
