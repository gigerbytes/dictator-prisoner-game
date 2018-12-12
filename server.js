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
playersListIds = []
game = new Game()
//
//
function assignRole(playerList){
  console.log(playerList)
  let dictatorIndex = Math.floor(Math.random()*playerList.length)
  console.log(playerList.forEach(function(player) { console.log(player.id)}))
  var dictator = playerList[dictatorIndex]

  prisoners = playerList.filter(function(player){
    return player !== dictator
  })
  var gameRoles =  {dictator:dictator, prisoners:prisoners}
  console.log(gameRoles.dictator)
  console.log('players')
  console.log(gameRoles.prisoners.forEach(function(prisoner){console.log(prisoner)}))
  console.log(gameRoles)
  return gameRoles
}

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
    playersListIds.push(socket.id)
    player = new Player(socket.id, `Player${players.length}`, true)
    game[`Player${players.length}`] == player

    console.log(players.length)
    let readyToStart = false;
    let info = ''

    // main game loop - 3 players
    if(players.length === 3){
      info = "The last player has joined, we're ready to start"
      readyToStart = true
      // set player roles (dictator, prisoners)
      let playerRoles = assignRole(playersListIds)
      console.log(playerRoles)
      if(playerRoles.dictator){
        console.log(playerRoles.dictator)
        io.sockets.connected[playerRoles.dictator].emit('role_assignment', 'You are the dictator')
      }
      playerRoles.prisoners.forEach(function(prisoner){
        console.log("emit prisoner")
        console.log(prisoner)
        io.sockets.connected[prisoner].emit('role_assignment', 'You are a player')
      })

    } else {
      info = "Hi we are waiting for the other players"
    }
    io.sockets.emit('info',{info:info, readyToStart:readyToStart})



    // end main game loop
  } else {
    io.sockets.connected[socket.id].emit('info',{info:'Sorry there are too many players in the game room, try again later',readyToStart:false})

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
