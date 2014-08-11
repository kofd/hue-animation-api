var hue = require('./hueanimation');

var beach = {
  'hue': 17000,
  'sat': 150,
  'bri': 254,
  'on': true }

var beach_accent = {
  'hue': 55000,
  'sat': 254,
  'bri': 254 }

var sunset = {
  'hue': 15000,
  'sat': 254,
  'bri': 254,
  'on': true }

var sunset_accent = {
  'hue': 5000,
  'sat': 254,
  'bri': 254 }

var fishbowl = {
  'hue': 47000,
  'sat': 254,
  'bri': 254,
  'on': true }

var fishbowl_accent = {
  'hue': 0,
  'sat': 254,
  'bri': 254 }

var nightlight = {
  'hue': 0,
  'sat': 254,
  'bri': 254,
  'on': false }

var nightlight_accent = {
  'hue': 0,
  'sat': 254,
  'bri': 0,
  'on': true }

var disco = function(){
  return {
        'hue': randomInt(0,62000),
        'sat': 254,
        'bri': 254,
        'on': true };
}

function randomInt (low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

var manager = hue.FishbowlManager({
    'start_state': function(light){
      /*console.log (light);
      if (light.index % 2 == 1) {
        console.log('blue light');
        return fishbowl;
      } else {
        console.log('red light');*/
        return sunset;
      //}
    },
    'next_state': function(light){
      return fishbowl_accent;
    }/*,
    'next_timeout': function(light){
      return 10000;
    },
    'next_speed': function(light){
      return 10000;
    }*/
});

hue.init(function(){
  manager.start();
}, [6,7]);
