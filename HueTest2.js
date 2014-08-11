var hue = require('./hueanimation');

console.log(hue);

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

var set_random_flicker = function() {
  var animation = hue.FlickerAnimation({
    'hue': hue.hue_list[randomInt(0,5)],
    'timeout': 500
  });
  animation.on_animation_complete = function(args) {
    setTimeout(set_random_flicker, randomInt(2000, 30000));
  };
  animation.animate();
};

console.log(hue.hue_list);

hue.init(function() {
  console.log('starting animation');
  set_random_flicker();
});
