var http = require('http');
var order = [2,1,3,4,5];

var generate_initial_hue_list = function() {
  var list = [];
  order.forEach(function(index){
    list.push({
      'index': index,
      'state': {
        'hue': 17500,
        'sat': 200,
        'bri': 254
      },
      'animation':null
    })
  });
}

var hue_list = generate_initial_hue_list();

var post_state_update = function(hue) {
  console.log("initializing post options")
  var post_data = JSON.stringify(hue.state);
  var post_options = {
    host: '192.168.0.4',
    path: '/api/newdeveloper/lights/' + hue.index.toString() + '/state',
    method: 'PUT'
  };

  var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });

  // post the data
  post_req.write(post_data);
  console.log("posted data")
  post_req.end();
}

var commit_hue_list = function(hue_list) {
  hue_list.forEach(function(hue) {
    post_state_update(hue);
  });
}

var animate = function() {
  console.log("animating")
  post_hue_list(hue_list, order);
  hue_list.pop();
  hue_list.unshift(next_val);
  next_val += 2500;
  if (next_val > 63000) next_val = 0;
  setTimeout(animate, 500);
}

animate();
