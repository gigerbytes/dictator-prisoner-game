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
class Game {
  constructor(id, round, playerList) {
    this.id = id
    this.round = round
    this.playerList = playerList
    this.currentState = { roundId: this.round }
    this.currentState.strategies = []
    this.currentState.payouts = []
    this.currentState.nextRoundList = []
    this.currentState.submissions = []
    this.previousStates = []
  }

  nextRound() {
    if (this.round > 5) {
      return false // game over
    }
    this.round = this.round + 1
    this.previosStates.push(this.currentState)
    this.currentState = { roundId: this.round }
    return true
  }

  assignRoles() {
    console.log(this.playerList)
    let dictatorIndex = Math.floor(Math.random() * this.playerList.length) // randomly pick dictator
    let dictator = this.playerList[dictatorIndex]

    let prisoners = this.playerList.filter(function(player) {
      return player !== dictator
    })

    this.currentState.playerRoles = { dictator: dictator, prisoners: prisoners }

    /// create a dictionary/index where we can search by role or playerId to get the other paremeter
    // because the playerRoles data structure is sometimes more difficult to work with
    this.currentState.playerRoleDict = []
    this.currentState.playerRoleDict.push({
      playerId: dictator,
      role: 'dictator'
    })
    prisoners.forEach(prisoner => {
      this.currentState.playerRoleDict.push({
        playerId: prisoner,
        role: 'prisoner'
      })
    })

    console.log(this.currentState.playerRoles)
    console.log(this.currentState.playerRoleDict)
  }

  calculatePayouts() {
    console.log(this.currentState.strategies)
    if (
      this.currentState.strategies.filter(player => player.strategy === 'a')
        .length === 1
    ) {
      console.log("single accept, single reject")
      // one accept, one reject
      // handle one accept one reject
      let dictatorPayout = 100 - this.currentState.endowment
      let prisonerAcceptPayout = this.currentState.endowment

      let dictatorId = this.currentState.playerRoles.dictator

      this.currentState.payouts.push({
        playerId: dictatorId,
        payout: dictatorPayout
      })
      let prisonerAcceptId = this.currentState.strategies.filter(
        prisoner => prisoner.strategy === 'a'
      )[0].playerId

      this.currentState.playerRoles.prisoners.forEach(prisoner => {
        if (prisoner === prisonerAcceptId) {
          this.currentState.payouts.push({
            playerId: prisoner,
            payout: prisonerAcceptPayout
          })
        } else {
          this.currentState.payouts.push({ playerId: prisoner, payout: 0 })
        }
      })
    } else if (
      this.currentState.strategies.filter(prisoner => prisoner.strategy === 'a')
        .length === 2
    ) {
      // both accept
      // handle both accept
      console.log("double accept")
      let dictatorPayout = 100 - this.currentState.endowment
      let playerPayout = (1 / 2) * this.currentState.endowment

      let dictatorId = this.currentState.playerRoles.dictator
      this.currentState.payouts.push({
        playerId: dictatorId,
        payout: dictatorPayout
      })

      this.currentState.playerRoles.prisoners.forEach(prisoner => {
        this.currentState.payouts.push({
          playerId: prisoner,
          payout: playerPayout
        })
      })
    } else {
      // this.currentState.strategies.filter((prisoner) => prisoner.strategy==='r').length === 2
      console.log('double reject')
      // handle both reject
      let dictatorPayout = 0
      let playerPayout = 25

      let dictatorId = this.currentState.playerRoles.dictator
      this.currentState.payouts.push({
        playerId: dictatorId,
        payout: dictatorPayout
      })

      this.currentState.playerRoles.prisoners.forEach(prisoner => {
        this.currentState.payouts.push({ playerId: prisoner, payout: 25 })
      })
    }
    return this.currentState.payouts
  }
  // generates the payout object tailored to player
  generatePersonalPayoutsObj(playerId){
    return this.currentState.payouts.map((player)=>{
      if(player.playerId == playerId){
        player.isMe = true
      } else {
        player.isMe = false
      }
      console.log(this.currentState.playerRoleDict)
      player.role = this.currentState.playerRoleDict.filter((playerFromDict) => playerFromDict.playerId == player.playerId)[0].role // get role for plyer
      player.strategy = this.currentState.strategies.filter((prisoner) => prisoner.playerId == player.playerId).length > 0 ? this.currentState.strategies.filter((prisoner) => prisoner.playerId == player.playerId)[0].strategy : 'none'
      return player
    })
  }
}

function createGame(roomId, playerList) {
  console.log('playerList')
  console.log(playerList)
  game = new Game(roomId, 0, playerList)
  gameList.push(game)
  return game
}

function getGame(roomId) {
  game = gameList.filter(game => game.id == roomId)[0]
  return game ? game : null // return game or null
}


io.on('connection', socket => {
  console.log('connection')
  socket.on('room', room => {
    // room is a string defining the room to join
    io.in(room).clients((error, clients) => {
      console.log(clients)
      console.log(clients.length)
      if (!clients || clients.length <= 2) {
        socket.join(room)
        io.to(room).emit('info', {
          info: 'Hi, we are waiting for other players',
          readyToStart: false
        })
      } else {
        io.sockets.connected[socket.id].emit('info', {
          info:
            'Sorry there are too many players in the game room, try again later',
          readyToStart: false
        })
      }
    })
    io.in(room).clients((error, clients) => {
      // room is complete with 3 players
      console.log("clients-length", clients.length)
      if (clients.length == 3) {
        var game = createGame(room, clients)
        io.to(room).emit('info', {
          info: 'The game is ready to start',
          readyToStart: true
        })
        game.assignRoles()

        // emit role assignment if dictator or not
        game.currentState.playerRoleDict.forEach(player => {
          io.sockets.connected[player.playerId].emit('role_assignment', {
            isDictator: player.role === 'dictator' ? true : false
          })
        })
      }
      // there are too many player sin the room, do not add them. Can suggest new room?
    })
  })

  socket.on('endow', data => {
    // get game object with appropriate room
    var game = getGame(data.roomId)
    if (!game) {
      throw new Error('no game found')
    }
    game.currentState.endowment = 100 - data.endowment
    // emit choices for the prisoners
    // using the playerRoles over here because easier to have the prisoners array
    game.currentState.playerRoles.prisoners.forEach(prisoner => {
      console.log(prisoner)
      io.sockets.connected[prisoner].emit('endow', 100 - data.endowment)
    })
  })

  socket.on('choose', data => {
    var game = getGame(data.roomId)
    if (!game) {
      throw new Error('no game found')
    }
    // can now do payout calculations based on answers of the prisoners
    // check if person submitted already
    if (game.currentState.submissions.indexOf(socket.id) == -1) {
      // has not submitted yet!
      game.currentState.strategies.push({
        playerId: socket.id,
        strategy: data.strategy
      })
      game.currentState.submissions.push(socket.id)
    } else {
      // emit already submitted error
    }
    //calculate payouts
    console.log(game.currentState.strategies.length)
    if (game.currentState.strategies.length == 2) {
      console.log("calculating strategies")
      game.calculatePayouts()
      console.log(game)
      game.playerList.forEach((playerId) => {
        console.log('emitting')
        io.sockets.connected[playerId].emit('payout', {payouts:game.generatePersonalPayoutsObj(playerId)})
      })
    }
  })

  socket.on('readyNextRound', data => {
    var game = getGame(data.roomId)
    if (!game) {
      throw new Error('no game found')
    }
    // check if 3 of the people submitted already
    // emit game over + thank you for playing
    game.currentState.nextRoundList.indexOf(socket.id)
      ? game.currentState.nextRoundList.push(socket.id)
      : null // push if person not in list
    if (game.currentState.nextRoundList.length < 3) {
      this.to(data.room).emit('info', {
        info: 'waiting for the next round to start'
      })
    } else {
      game.nextRound()
        ? this.to(data.room).emit('nextRound')
        : this.to(data.room).emit('endGame')
    }
  })
  // ****
})
server.listen(9000, function() {
  console.log(`Listening on ${server.address().port}`)

})
