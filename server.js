var express = require('express')
var app = express()
var server = require('http').Server(app)
var io = require('socket.io')(server)
app.set('view engine', 'ejs')

app.use(express.static(__dirname + '/public'))
app.get('/', function(req, res) {
  res.render('index')
})

const gameList = []

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
//    playerRoles:{
//      playerId: dictator
//      player2Id: prisoner
//    },
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
class Game = {
  consructor(id, round, playerList){
    this.id = id
    this.round = round
    this.playerList = playerList
    this.currentState = {roundId = this.round}
    this.currentState.strategies =[]
    this.currentState.payouts =[]
    this.previousStates=[]
  }

  function nextRound(){
    if(this.round>5){
      return "game over"
    }
    this.round = this.round +1
    this.previosStates.push(this.currentState)
    this.currentState = {roundId = this.round}
  }

  function assignRoles(){
    let dictatorIndex = Math.floor(Math.random() * this.playerList.length) // randomly pick dictator
    var dictator = this.playerList[dictatorIndex]

    prisoners = playerList.filter(function(player) {
      return player !== dictator
    })

    this.currentState.playerRoles = { dictator: dictator, prisoners: prisoners }

    /// create a dictionary/index where we can search by role or playerId to get the other paremeter
    // because the playerRoles data structure is sometimes more difficult to work with
    this.currentState.playerRoleDict = []
    this.currentState.playerRoleDict.push({playerId: dictator, role: dictator})
    prisoners.forEach((prisoner) => {
      this.currentState.playerRoleDict.push({playerId: prisoner, role: prisoner})
    })

    console.log(this.currentState.playerRoles)
    console.log(this.currentState.playerRoleDict)
  }

  function calculatePayouts(){
    if (
       this.currentState.strategies.filter((player) => player.strategy==='a').length === 1

     ) {
       // one accept, one reject
       // handle one accept one reject
       let dictatorPayout = 100 - this.currentState.endowment
       let prisonerAcceptPayout = this.currentState.endowment

       let dictatorId = this.currentState.playerRoles.dictator

       this.currentState.payouts.push({playerId: dictatorId, payout:dictatorPayout})
       prisonerAcceptId = this.currentState.strategies.filter((prisoner)=> prisoner.strategy === 'a')[0].playerId

       this.currentState.playerRoles.prisoners.forEach((prisoner)=>{
         if(prisoner === prisonerAcceptId){
           this.currentState.payouts.push({playerId:prisoner, payout:prisonerAcceptPayout})
         } else {
           this.currentState.payouts.push({playerId:prisoner, payout:0})
         }
       })


     } else if (
       this.currentState.strategies.filter((prisoner) => prisoner.strategy==='a').length === 2
     ) {
       // both accept
       // handle both accept
       let dictatorPayout = 100 - this.currentState.endowment
       let playerPayout = (1 / 2) * this.currentState.endowment

       let dictatorId = this.currentState.playerRoles.dictator
       this.currentState.payouts.push({playerId: dictatorId, payout:dictatorPayout})

       this.currentState.playerRoles.prisoners.forEach((prisoner)=>{
         this.currentState.payouts.push({playerId:prisoner, payout:playerPayout})
       })

     } else { // this.currentState.strategies.filter((prisoner) => prisoner.strategy==='r').length === 2

       // handle both reject
       let dictatorPayout = 0
       let playerPayout = 25

       let dictatorId = this.currentState.playerRoles.dictator
       this.currentState.payouts.push({playerId: dictatorId, payout:dictatorPayout})

       this.currentState.playerRoles.prisoners.forEach((prisoner)=>{
         this.currentState.payouts.push({playerId:prisoner, payout:25})
       })
     }
  }
}

function createGame(roomId, playerList){
  game = new Game(roomId, 0, playerList, {}, {}, [])
  gameList.push(game)
  return game
}


function getGame(roomId){
  game = gameList.filter((game) => game.id == roomId)[0]
  return game ? game : null // return game or null
}

io.on('connection', socket => {
  socket.on('room', (room) => {
    // room is a string defining the room to join
    if (io.sockets.clients(room).length <= 3) {
      socket.join(room)
      io.to(room).emit('info', {
        info: 'Hi, we are waiting for other players',
        readyToStart: false
      })

      // room is complete with 3 players
      if (io.sockets.clients(room).length == 3) {
        var game = createGame(room, io.sockets.clients(room))
        io.to(room).emit('info', { info: 'The game is ready to start', readyToStart: true })
        game.assignRoles()

        // emit role assignment if dictator or not
        game.currentState.playerRoleDict.forEach((player) => {
          io.sockets.connected[player.playerId].emit('role_assignment', {
                    isDictator: player.role === 'dictator' ? true : false
                  })
        })
      }
      // there are too many player sin the room, do not add them. Can suggest new room?
    } else {
      io.sockets.connected[socket.id].emit('info', {
        info: 'Sorry there are too many players in the game room, try again later',
        readyToStart: false
      })
    }
  })

  socket.on('endow', (data) => {
    // get game object with appropriate room
    var game = getGame(data.roomId)
    if(!game){ throw new Error('no game found')}
    game.currentState.endowment = data.endowment
    // emit choices for the prisoners
    // using the playerRoles over here because easier to have the prisoners array
    game.currentState.playerRoles.prisoners.forEach((prisoner) => {
      io.sockets.connected[prisoner].emit('endow')
    })
  })

  socket.on('choose', (data) => {
    var game = getGame(data.roomId)
    if(!game){ throw new Error('no game found')}
    // can now do payout calculations based on answers of the prisoners
    // check if person submitted already
    if(!game.currentState.submissions[socket.id]{
      // has not submitted yet!
      game.currentState.strategies.push({playerId: socket.id, strategy: data.strategy})
    }) else {
      // emit already submitted error
    }
    //calculate payouts
    if(game.currentState.strategies.count == 2){
      game.calculatePayouts()
    }
  })
})

// ************** OLD CODE

//
// function Game(gameState, playerList, round, readyToStart, gameString) {
//   Game.gameState = gameState // object
//   Game.playerList = playerList // list of players
//   Game.gameState.currentRound = round // which round?
//   Game.readyToStart = readyToStart
// }
//
// function assignRole(playerList) {
//   console.log(playerList)
//   let dictatorIndex = Math.floor(Math.random() * playerList.length) // randomly pick dictator
//   var dictator = playerList[dictatorIndex]
//
//   prisoners = playerList.filter(function(player) {
//     return player !== dictator
//   })
//
//   var playerRoles = { dictator: dictator, prisoners: prisoners }
//   console.log(playerRoles)
//   return playerRoles
// }
//
// function assignPayouts(game) {
//   let currentRound = game.round
//   if (
//     game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='a').length === 1
//
//   ) {
//     // one accept, one reject
//     // handle one accept one reject
//     let dictatorPayout = 100 - game.gameState.rounds[currentRound].endowment
//     let prisonerAcceptPayout = game.gameState.rounds[currentRound].endowment
//
//     let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator
//
//     game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})
//     prisonerAcceptId = game.gameState.rounds[currentRound].strategies.filter((prisoner)=> prisoner.strategy === 'a')[0].playerId
//
//     game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
//       if(prisoner === prisonerAcceptId){
//         game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:prisonerAcceptPayout})
//       } else {
//         game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:0})
//       }
//     })
//
//
//   } else if (
//     game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='a').length === 2
//   ) {
//     // both accept
//     // handle both accept
//     let dictatorPayout = 100 - game.gameState.rounds[currentRound].endowment
//     let playerPayout = (1 / 2) * game.gameState.rounds[currentRound].endowment
//
//     let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator
//     game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})
//
//     game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
//       game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:playerPayout})
//     })
//
//   } else { // game.gameState.rounds[currentRound].strategies.filter((prisoner) => prisoner.strategy==='r').length === 2
//
//     // handle both reject
//     let dictatorPayout = 0
//     let playerPayout = 25
//
//     let dictatorId = game.gameState.rounds[currentRound].playerRoles.dictator
//     game.gameState.rounds[currentRound].payouts.push({playerId: dictatorId, payout:dictatorPayout})
//
//     game.gameState.rounds[currentRound].playerRoles.prisoners.forEach((prisoner)=>{
//       game.gameState.rounds[currentRound].payouts.push({playerId:prisoner, payout:25})
//     })
//   }
//   return game
// }
//
// function buildPlayerPayoutMessage(playerId, game){
//   gamePayoutAr = game.gameState.rounds[currentRound].payouts
//   payoutMsgAr = []
//
//   gamePayoutAr.map((payout) => {
//
//   })
// }
//
// function addRound(game){
//   console.log(game.gameState.rounds)
//   return game.gameState.rounds.push({
//     playerRoles:{},
//     strategies:[],
//     payouts:[]
//   })
// }
//
// server.listen(9000, function() {
//   console.log(`Listening on ${server.address().port}`)
// })
//
// var game = new Game({}, [], 0, false)
// console.log(game.playerList)
// game.gameState ={rounds:[]}
// game.playerList = []
// game.round = 0
// game.readyToStart = false
//
// game.rounds = addRound(game)
// console.log(game)
//
// io.on('connection', function(socket) {
//   var currentRound = game.round
//   // dictator endows
//   socket.on('endow', function(data) {
//     console.log(data)
//     game.gameState.rounds[currentRound].endowment = 100 - parseFloat(data, 10)
//     game.gameState.rounds[currentRound].playerRoles.prisoners.forEach(function(prisoner) {
//       io.sockets.connected[prisoner].emit(
//         'endowment',
//         100 - parseFloat(data, 10)
//       )
//     })
//   })
//
//   // players send decision
//   socket.on('choose', function(data) {
//     console.log(data)
//
//     if (game.gameState.rounds[currentRound].strategies.length < 1) {
//       // check if player already submitted so we don't double submit
//       if (
//         game.gameState.rounds[currentRound].strategies.filter(
//           playerId => playerId === socket.id
//         ).length == 0
//       ) {
//         game.gameState.rounds[currentRound].strategies.push({
//           playerId: socket.id,
//           strategy: data
//         })
//       } else {
//         // someone tried to submit twice
//         io.sockets.connected[socket.id].emit['error', 'Sorry you already submitted!']
//       }
//     } else {
//       // handle give results
//       // calculate payouts
//
//       // emit results
//       console.log(game.gameState.rounds)
//       game = assignPayouts(game)
//       console.log( game.gameState.rounds[currentRound])
//       // need to do custom object per player
//       // double loop?
//       game.gameState.rounds[currentRound].strategies.forEach((currentPlayer) => { // add role to list?
//         // currentPlayerObject = {
//         //   myPayout : currentPlayer.payout
//         //   dictatorPayout :
//         // }
//         game.gameState.rounds[currentRound].strategies.forEach((player) => {
//           currentPlayerObject.id = currentPlayer.playerId
//         })
//         io.sockets.connected[player.playerId].emit('result', player.payout)
//       })
//     }
//   })
//
//   socket.on('newRound', function(data) {
//     game.round = game.round+1
//     game = game.addRound()
//   })
//
//   console.log('New client has connected with id:', socket.id)
//
//   if (game.playerList.length < 3) {
//     game.playerList.push(socket.id)
//     // playersListIds.push(socket.id)
//     // player = new Player(socket.id, `Player${players.length}`, true)
//     // game[`Player${players.length}`] == player
//
//     console.log(game.playerList.length)
//
//     let info = ''
//     // main game loop - 3 players
//     if (game.playerList.length === 3) {
//       info = "The last player has joined, we're ready to start"
//       game.readyToStart = true
//       let currentRound = game.round
//       // set player roles (dictator, prisoners)
//       game.gameState.rounds[currentRound].playerRoles = assignRole(
//         game.playerList
//       )
//       console.log(game.gameState.rounds[0])
//       let playerRoles = game.gameState.rounds[currentRound].playerRoles
//       console.log(game)
//
//       if (playerRoles.dictator) {
//         console.log(playerRoles.dictator)
//         io.sockets.connected[playerRoles.dictator].emit('role_assignment', {
//           isDictator: true
//         })
//       }
//       playerRoles.prisoners.forEach(function(prisoner) {
//         console.log('emit prisoner  ')
//         console.log(prisoner)
//         io.sockets.connected[prisoner].emit('role_assignment', {
//           isDictator: false
//         })
//       })
//     } else {
//       info = 'Hi we are waiting for the other players'
//     }
//     io.sockets.emit('info', { info: info, readyToStart: game.readyToStart })
//
//     // end main game loop
//   } else {
//     io.sockets.connected[socket.id].emit('info', {
//       info:
//         'Sorry there are too many players in the game room, try again later',
//       readyToStart: false
//     })
//   }
// })
//
// io.on('disconnect', function() {
//   playersListIds = playersListIds.filter(function(player) {
//     return player.id !== socket.id
//   })
// })
