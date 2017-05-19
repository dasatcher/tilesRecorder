
var TilesClient = require('./tiles-client.js');
var http = require('http');

var userTiles = [];

//get all tiles
//http://138.68.144.206:3000/users/TestUser/tiles

 http.get('http://138.68.144.206:3000/users/TestUser/tiles', function(res) {
    

    // Continuously update stream with data
    var body = '';
    res.on('data', function(d) {
     
        body += d;
    });

    res.on('end', function() {
        // Data reception is done
        var tiles = JSON.parse(body);
        
        tiles.map((tile) => (
            userTiles.push({name:tile.name, id: tile._id})
            
        ) );
        
        
    });

  }).on('error', function(e) {
    console.log('Got error: ${e.message}');
  });

// export function for listening to the socket
module.exports = function (socket) {
  
  var tilesClient = new TilesClient('TestUser','138.68.144.206',1883).connect();
  
  tilesClient.on('receive', function(tileId, event){
 
	console.log('Message received from ' + tileId + ': ' + JSON.stringify(event));
  
  socket.emit('tileEvent', {
    tileId: tileId,
    event: event
  });
});

socket.emit('init', userTiles);

 socket.on('tileCmd', function (msg) {

   tilesClient.send(msg.tileId, msg.cmdString,msg.param1,msg.param2);
  });


};
