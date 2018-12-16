var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)
app.set('view engine', 'ejs')

app.use(express.static(__dirname + '/public'))
app.get('/', function(req, res) {
  res.render('index')
})

players = []
playersListIds = []
playerRoles = {}
gameState = {}

// Game state looks like this:
// {
//   currentRound: 2,
//   gameKey: 'string',
//  rounds:[
//  {
//     roundNum: 0,
//     players: {
//       dictator: playerId,
//       prisoners:[playerId, playerId]
//     },
//     endowment: 20,
//     strategies: [
//       {playerId: playerId, strategy: a},
//       {playerId: playerId, strategy: r}
//     ],
//     payouts:[
//       {playerId: playerId, payout: 80}
//       {playerId: playerId, payout: 10}
//       {playerId: playerId, payout: 10}
//     ],
//   }
//  ...
//  ]
// }

function Game(gameState, playerList, round, readyToStart) {
  Game.gameState = gameState // object
  Game.playerList = playerList // list of players
  Game.gameState.currentRound = round // which round?
  Game.readyToStart = readyToStart
}

function assignRole(playerList) {
  console.log(playerList)
  let dictatorIndex = Math.floor(Math.random() * playerList.length)
  console.log(
    playerList.forEach(function(player) {
      console.log(player.id)
    })
  )
  var dictator = playerList[dictatorIndex]

  prisoners = playerList.filter(function(player) {
    return player !== dictator
  })

  var playerRoles = { dictator: dictator, prisoners: prisoners }
  console.log(playerRoles.dictator)
  console.log('players')
  console.log(
    playerRoles.prisoners.forEach(function(prisoner) {
      console.log(prisoner)
    })
  )
  console.log(playerRoles)
  return playerRoles
}

function assignPayouts(game) {
  let currentRound = game.round
  if (
    game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='a').length === 1

  ) {
    // one accept, one reject
    // handle one accept one reject
    let dictatorPayout = 100 - game.gameState.rounds[currentRound].endowment
    let prisonerAcceptPayout = game.gameState.rounds[currentRound].endowment

    let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator

    game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})
    prisonerAcceptId = game.gameState.rounds[currentRound].strategies.filter((prisoner)=> prisoner.strategy === 'a')[0].playerId

    game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
      if(prisoner === prisonerAcceptId){
        game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:prisonerAcceptPayout})
      } else {
        game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:0})
      }
    })


  } else if (
    game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='a').length === 2
  ) {
    // both accept
    // handle both accept
    let dictatorPayout = 100 - game.gameState.rounds[currentRound].endowment
    let playerPayout = (1 / 2) * game.gameState.rounds[currentRound].endowment

    let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator
    game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})

    game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
      game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:playerPayout})
    })

  } else { // game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='r').length === 2

    // handle both reject
    let dictatorPayout = 0
    let playerPayout = 25

    let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator
    game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})

    game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
      game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:25})
    })
  }
  return game
}

function addRound(game){
  console.log(game.gameState.rounds)
  return game.gameState.rounds.push({
    playerRoles:{},
    strategies:[],
    payouts:[]
  })
}

server.listen(9000, function() {
  console.log(`Listening on ${server.address().port}`)
})

var game = new Game({}, [], 0, false)
console.log(game.playerList)
game.gameState ={rounds:[]}
game.playerList = []
game.round = 0
game.readyToStart = false

game.rounds = addRound(game)
console.log(game)

io.on('connection', function(socket) {
  var currentRound = game.round
  // dictator endows
  socket.on('endow', function(data) {
    console.log(data)
    game.gameState.rounds[currentRound].endowment = 100 - parseFloat(data, 10)
    game.gameState.rounds[currentRound].playerRoles.prisoners.forEach(function(prisoner) {
      io.sockets.connected[prisoner].emit(
        'endowment',
        100 - parseFloat(data, 10)
      )
    })
  })

  // players send decision
  socket.on('choose', function(data) {
    console.log(data)

    if (game.gameState.rounds[currentRound].strategies.length < 1) {
      // check if player already submitted so we don't double submit
      if (
        game.gameState.rounds[currentRound].strategies.filter(
          playerId => playerId === socket.id
        ).length == 0
      ) {
        game.gameState.rounds[currentRound].strategies.push({
          playerId: socket.id,
          strategy: data
        })
      } else {
        // someone tried to submit twice
        io.sockets.connected[socket.id].emit['error', 'Sorry you already submitted!']
      }
    } else {
      // handle give results
      // calculate payouts

      // emit results
      console.log(game.gameState.rounds)
      game = assignPayouts(game)
      console.log( game.gameState.rounds[currentRound])
      // need to do custom object per player
      // double loop?
      game.gameState.rounds[currentRound].strategies.forEach((currentPlayer) => { // add role to list?
        // currentPlayerObject = {
        //   myPayout : currentPlayer.payout
        //   dictatorPayout :
        // }
        game.gameState.rounds[currentRound].strategies.forEach((player) => {
          currentPlayerObject.id = currentPlayer.playerId
        })
        io.sockets.connected[player.playerId].emit('result', player.payout)
      })
    }
  })

  socket.on('newRound', function(data) {
    game.round = game.round+1
    game = game.addRound()
  })

  console.log('New client has connected with id:', socket.id)

  if (game.playerList.length < 3) {
    game.playerList.push(socket.id)
    // playersListIds.push(socket.id)
    // player = new Player(socket.id, `Player${players.length}`, true)
    // game[`Player${players.length}`] == player

    console.log(game.playerList.length)

    let info = ''
    // main game loop - 3 players
    if (game.playerList.length === 3) {
      info = "The last player has joined, we're ready to start"
      game.readyToStart = true
      let currentRound = game.round
      // set player roles (dictator, prisoners)
      game.gameState.rounds[currentRound].playerRoles = assignRole(
        game.playerList
      )
      console.log(game.gameState.rounds[0])
      let playerRoles = game.gameState.rounds[currentRound].playerRoles
      console.log(game)

      if (playerRoles.dictator) {
        console.log(playerRoles.dictator)
        io.sockets.connected[playerRoles.dictator].emit('role_assignment', {
          isDictator: true
        })
      }
      playerRoles.prisoners.forEach(function(prisoner) {
        console.log('emit prisoner  ')
        console.log(prisoner)
        io.sockets.connected[prisoner].emit('role_assignment', {
          isDictator: false
        })
      })
    } else {
      info = 'Hi we are waiting for the other players'
    }
    io.sockets.emit('info', { info: info, readyToStart: game.readyToStart })

    // end main game loop
  } else {
    io.sockets.connected[socket.id].emit('info', {
      info:
        'Sorry there are too many players in the game room, try again later',
      readyToStart: false
    })
  }
})

io.on('disconnect', function() {
  playersListIds = playersListIds.filter(function(player) {
    return player.id !== socket.id
  })
})
