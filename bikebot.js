var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
var app = express();

var reservation_callback = "reservation_callback";
var reserve_button = "reservation_button";
var return_button = "return_button";
var initial_data = {
          "bikes": {},
          "reservations": []
        };

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/list', function (req, res) {
  var context = req.webtaskContext;
  var location = req.body.text.toLowerCase() || null;
  
  context.storage.get(function (error, data) {
    if (error) {res.sendStatus(500); return;}
    
    data = data || initial_data;
    
    var id = null;
    var i = null;
    var old_reservation = null;
    var bikes = [];
    var bike = null;
    var actions = [];
    
    console.log("List Bikes");
    
    for (id in data.bikes) {
      bike = data.bikes[id];
      
      for (i = 0; i < data.reservations.length; i++){
        old_reservation = data.reservations[i];
        if (old_reservation.bike_id == bike.id && old_reservation.isReturned === false) {
          bike.reservation = old_reservation;
          break;
        }
      }
      bikes.push(bike);
    }
    
    console.log(location);
    console.log(bikes);
    
    if (location !== undefined && location !== null) {
      bikes = bikes.filter(bike => bike.location.toLowerCase() === location.toLowerCase());
    }
    
    console.log(bikes);
    
    for (i = 0; i < bikes.length; i++){
      bike = bikes[i];
      
      var attachment =
      {"callback_id": reservation_callback,
      "title": bike.name +  ", " + bike.location};
      
      if (bike.reservation !== undefined && bike.reservation !== null){
        if(bike.reservation.user === req.body.user_name){
          attachment.actions =
          [{
            "type":"button",
            "text": "Palauta pyörä",
            "style": "primary",
            "name": return_button,
            "value": bike.id
          }];
        }else{
          attachment.text = "Varattu käyttäjälle" + bike.reservation.user;
        }
      }else {
        attachment.actions = 
        [{
          "type": "button",
          "text": "Varaa pyörä",
          "name": reserve_button,
          "value": bike.id
        }];
      }
      
      actions.push(attachment);
    }
    
    console.log(actions)
    
    if (actions.length !== 0){
      res.send(
      {"response_type": "ephemeral",
        "text": "Solitan fillaribotti palveluksessasi!",
        "attachments": actions
      });
    } else {
      res.send(
        {
          "response_type": "ephemeral",
          "text": "Ei pyöriä paikkakunnalla " + req.body.text + " :iiromad:"
      });
    }
  });
});

var reserveBike = function(req, res, action){
  var context = req.webtaskContext;
  
  context.storage.get(function (error,data){
    if (error) {res.sendStatus(500); return;}
    
    var new_data = data;
    var reservation = 
    {
      "user": req.body.payload.user.name,
      "timestamp": req.body.payload.action_ts,
      "bike_id": action.value,
      "isReturned": false
    };
    
    new_data.reservations.push(reservation);
    
    context.storage.set(new_data, function(error){
      if (error) {res.sendStatus(500); return;}
      
      res.send(
        {
          "response_type": "ephemeral",
          "replace_original":true,
          "text": "Varasin sinulle pyörän " + data.bikes[action.value].name + ", " + data.bikes[action.value].location + " :thumbsup:"
      });
    });
  });
};

var returnBike = function(req, res, action){
  var context = req.webtaskContext;
  
  context.storage.get(function (error,data){
    if (error) {res.sendStatus(500); return;}
    
    var new_reservations = [];
    
    for (var i = 0; i < data.reservations.length; i++){
      var old_reservation = data.reservations[i];
      
      if(old_reservation.isReturned === false &&
      old_reservation.bike_id == action.value &&
      old_reservation.user == req.body.payload.user.name){
        old_reservation.isReturned = true;
      }
      
      new_reservations.push(old_reservation);
    }
    
    data.reservations = new_reservations;
    
    context.storage.set(data, function(error){
      if (error) {res.sendStatus(500); return;}
      
      res.send(
        {
          "response_type": "ephemeral",
          "replace_original":true,
          "text": "Pyörä " + data.bikes[action.value].name + ", " + data.bikes[action.value].location + " palautettu!"
      });
    });
  });
};

var handleReservation = function (req, res){
  var action = req.body.payload.actions[0];
  switch (action.name){
    case return_button:
      returnBike(req, res, action);
      break;
    case reserve_button:
      reserveBike(req, res, action);
      break;
    default:
      console.error("Unknown reservation action " + req.body.payload.name);
      res.sendStatus(404);
      return;
  }
};

app.post('/action', function(req, res) {
  
  console.log("ACTION!")
  console.log(JSON.parse(req.body.payload));
  req.body.payload = JSON.parse(req.body.payload);
  
  switch (req.body.payload.callback_id){
  case reservation_callback:
    handleReservation(req, res);
    break;
  default:
    console.error("Unknown callback id" + req.body.payload.callback_id);
    res.sendStatus(404);
    return;
  }
});

module.exports = Webtask.fromExpress(app);
