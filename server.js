var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server)
app.set('view engine', 'ejs')

app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
  res.render('index')
});


app.get('/got', (req, res) => {
  res.status(200).send('nothing happens here')
})
//
function Player(id, name, numbers, isDictator ){// role == dictator || p/ayer
  this.id=id
  this.name = name
  this.numbers = numbers
  this.isDictator = isDictator // is playing when role == true
}

function Game(playerA, playerB, playerC, numbers, operators, movingPlayers){
  this.playerA = playerA
  this.playerB = playerB
  this.operators = operators
  this.movingPlayers = movingPlayers
}
//
players = []
game = new Game()
//
//
// function assignRole(playerList){
//   let dictatorIndex = Math.floor(Math.random()*playerList.length)
//   var dictator = playerList[dictatorIndex]
//   var prisoners = playerList.splice(dictatorIndex, 1) // remove 1 element from list from dictatorIndex
//
// }

// function dictatorStep(dictator, prisoners)=>{
//
// }

server.listen(9000, function () {
  console.log(`Listening on ${server.address().port}`);
});


io.on('connection',(socket) => {
  console.log("New client has connected with id:",socket.id);

  if(players.length < 3){
    players.push(socket)
    player = new Player(socket.id, `Player${players.length}`, true)
    game[`Player${players.length}`] == player

    console.log(players.length)
    let readyToStart = false;
    let info = ''
    if(players.length === 3){
      info = "The last player has joined, we're ready to start"
      readyToStart = true
    } else {
      info = "Hi we are waiting for the other players"
    }
    io.sockets.emit('info',{info:info, readyToStart:readyToStart})

  } else {
    io.sockets.emit('info',{info:'Sorry there are too many players in the game room, try again later',readyToStart:false})

  }

  // players.push(socket)
  //
  // if(players.length === 1){
  //   player = new Player(socket.id, 'Player A', [], true)
  //   game.playerA= player
  //
  // } else if (players.length === 2){
  //   game.playerB.id =
  // }

})
