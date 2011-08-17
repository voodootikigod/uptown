var postgres    =   require("pg").native;

module.exports = (function(app_config) {
	var client = new postgres.Client(app_config.postgresql);
	client.connect();
	return {connection: client};
});


    
    
    