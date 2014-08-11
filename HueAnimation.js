var http = require('http');
var order = [2,1,3,4,5];
var host = '192.168.0.4';
var path = '/api/newdeveloper/lights/';

function clone(obj) {
  if (typeof obj === 'object') {
    if (obj instanceof Array) {
      var copy = [];
      for (var i = 0; i < obj.length; i++) {
        copy[i] = clone(obj[i]);
      }
      return copy;
    } else if (obj instanceof Object) {
      var copy = {};
      for (var attr in obj) {
        copy[attr] = clone(obj[attr]);
      }
      return copy;
    }
  } else {
    return obj;
  }
}

var merge = function(args1, args2) {
  var args3 = {};
  for (var name in args1) {
    args3[name] = args1[name];
  }
  for (var name in args2) {
    args3[name] = args2[name];
  }
  return args3;
}

var mergeInto = function(args1, args2) {
  for (var name in args2) {
    args1[name] = args2[name];
  }
  return args1;
}

var get_hue_state = function(callback) {
  var get_options = {
    host: host,
    path: path,
    method: 'GET'
  };

  var get_req = http.request(get_options, function(res) {
      res.setEncoding('utf8');
      var data = '';
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function(){
        callback(JSON.parse(data));
      });
  });

  get_req.write("");
  get_req.end();
};

var animation_manager = {};

var HueAnimationManager = function(args) {
  var manager = merge({
    'start_state': function(args){
      return {};
    },
    'next_timeout': function(args){
      return 5000;
    }
  }, args);
  manager.next = function(args) {manager._next(args)};
  manager.start = function(){
    hue_list.forEach(function(hue){
      hue.state = merge(hue.state, manager.start_state(hue));
    });
    commit_hue_list();
    var start_animation = manager.get_start_animation();
    if (start_animation != null) {
      console.log('initializing starting animation.');
      start_animation.on('complete', function(){
        console.log('start animation terminated.')
        manager.next({
          'animation': start_animation,
          'hue': null
        });
      });
      start_animation.animate();
    } else {
      manager.next({
        'animation': null,
        'hue': null
      });
    }
  };
  manager.get_start_animation = function(args) {return null;};
  manager.get_next_animation = function(args) {return null;};
  manager._next = function(args) {
    console.log('manager.next')
    var animation = this.get_next_animation(args);
    if (animation == null) {
      return;
    }
    setTimeout(function(){
      animation.on('complete',function(){manager.next({
        'animation': animation,
        'hue': animation.hue
      })});
      animation.animate();
    }, this.next_timeout(args) + 10);
  }
  animation_manager = manager;
  return mergeInto(manager, args);
}

HueAnimationManager();

var hue_list = [];

var init_hue = function(callback, order_list) {
  if (order_list != null) {
    order = order_list;
  }

  get_hue_state(function(state){
    order.forEach(function(index){
      hue_list.push({
        'index': index,
        'state': state[index].state,
        'animation': null
      });
    });
    callback();
  });
}

var post_state_update = function(hue) {
  if ('colormode' in hue.state) delete hue.state.colormode;
  if ('reachable' in hue.state) delete hue.state.reachable;
  if ('ct' in hue.state) delete hue.state.ct;
  if ('xy' in hue.state) delete hue.state.xy;
  var post_data = JSON.stringify(hue.state);
  var post_options = {
    host: host,
    path: path + hue.index.toString() + '/state',
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
  post_req.end();
};

var HueAnimation = function(args) {
  var animation = merge({
    'type': 'default',
    'next_timeout': function(){return 0;},
    '_complete': true,
    'id': randomInt(0,10000)
  }, args);

  if (!('hue' in animation)){
    console.log(animation);
  }
  animation.hue.aid = animation.id;
  animation.on_start = function(args){};
  animation.on_state_change = function(args){};
  animation.on_animation_complete = function(args){};
  animation.is_complete = function(){return this._complete;};
  animation.get_next_state = function(){return this.hue.state;};

  var events = {
    'start': [function(args){animation.on_start(args);}],
    'state_change': [function(args){animation.on_state_change(args);}],
    'complete': [function(args){animation.on_animation_complete(args);}]
  }
  var _on_event = function(eventName){
    console.log('animation event: ' + eventName);
    events[eventName].forEach(function(callback){
      callback({
        'animation': animation,
        'hue': animation.hue
      });
    });
  }
  animation.on = function(eventName, callback) {
    if (eventName in events) {
      events[eventName].push(callback);
    }
  }

  animation._animate = function(){
    if (animation.hue.aid != animation.id) {
      _on_event('complete');
      return animation;
    }

    animation.hue.state = merge(animation.hue.state, animation.get_next_state());
    post_state_update(animation.hue);
    _on_event('state_change');

    if (animation.is_complete() || animation.next_timeout() <= 0) {
      var last_timeout = 400;
      if ('transitiontime' in animation.hue) {
        last_timeout = animation.hue.transitiontime * 100;
      }
      setTimeout(function(){
        _on_event('complete');
        if (animation.hue.aid == animation.id) {
          animation.hue.aid = -1;
        }
      }, last_timeout);
    } else {
      setTimeout(animation._animate, animation.next_timeout());
    }
  }

  animation.animate = function(){
    if ('delay' in animation) {
      setTimeout(function(){
        _on_event('start');
        animation._animate();
      }, animation.delay);
    } else {
      _on_event('start');
      animation._animate();
    }
  };

  console.log('animation of type ' + animation.type + ' created.');

  return mergeInto(animation, args);
};

var MultiAnimation = function(args){
  animation = merge({
    'type': 'mulit',
    'children': [],
    '_complete': false,
    'id': randomInt(0,10000)
  }, args);

  animation.on_start = function(args){};
  animation.on_state_change = function(args){};
  animation.on_child_complete = function(args){};
  animation.on_animation_complete = function(args){};
  animation.is_complete = function(){return this._complete;};

  var num_animations = animation.children.length;
  var events = {
    'start': [function(args){animation.on_start(args);}],
    'state_change': [function(args){animation.on_state_change(args);}],
    'child_complete': [function(args){animation.on_child_complete(args);}],
    'complete': [function(){animation._complete = true;},
    function(args){animation.on_animation_complete(args);}]
  }

  var _on_event = function(eventName, child, light){
    console.log('animation event: ' + eventName);
    events[eventName].forEach(function(callback){
      callback({
        'animation': animation,
        'child': child,
        'hue': light
      });
    });
  }

  animation.on = function(eventName, callback) {
    if (eventName in events) {
      events[eventName].push(callback);
    }
  }

  var _init_child = function(child) {
    child.on('state_change', function(args){
      _on_event('state_change', child, child.hue);
    });
    child.on('complete', function(args){
      _on_event('child_complete', child, child.hue)
      if (--num_animations == 0) {
        _on_event('complete', null, null);
      }
    });
  }

  animation.add_child = function(child) {
    animation.children.push(child);
    num_animations++
    _init_child(child);
  }

  animation.children.forEach(function(child){
    _init_child(child);
  });

  animation.animate = function() {
    _on_event('start', null, null);
    if (animation.children.length == 0) {
      _on_event('complete', animation, null, null);
    }
    animation.children.forEach(function(child){
      if ('delay' in child) {
        setTimeout(child.animate, child.delay);
      } else {
        child.animate();
      }
    });
  };

  return mergeInto(animation, args);
}

var SetStateAnimation = function(args) {
  // requires state parameter
  var animation = HueAnimation(merge({
    'type': 'set'
  }, args));
  animation.get_next_state = function(){
    if ('state' in animation){
      console.log ('state is active')
      return animation.state;
    } else {
      return animation.hue.state;
    }
  };
  return mergeInto(animation, args);
};

var update_hue_state = function(hue){SetStateAnimation({'hue':hue}).animate();}
var commit_hue_list = function(){hue_list.forEach(function(hue){update_hue_state(hue);});};

var FlickerAnimation = function(args) {
  var animation = HueAnimation(merge({
    'type': 'flicker',
    'timeout': 400,
    'state': { 'hue': 0 },
    'return_state': {},
    'compute_transition_time': function(){return Math.max(1,Math.floor(this.timeout / 100));}
  }, args));
  var original_transitiontime = 4;
  if ('transitiontime' in animation.hue.state) {
    original_transitiontime = animation.hue.state.transitiontime
  }
  animation.next_timeout = function(){return Math.max(animation.timeout, 100)};
  animation.hue.state.transitiontime = animation.compute_transition_time();
  var state_backup = merge(clone(animation.hue.state), animation.return_state);
  animation._complete = false;
  animation.is_state_applied = false;
  animation.get_next_state = function(){
    if (animation.is_state_applied) {
      animation.is_state_applied = false;
      animation._complete = true;
      return state_backup;
    } else {
      animation.is_state_applied = true;
      return animation.state;
    }
  }
  animation.on_animation_complete = function(args){
    args.hue.transitiontime = original_transitiontime;
  }
  return mergeInto(animation,args);
};

var CascadeAnimation = function(args){
  var new_args = merge({
    'type': 'cascade',
    'timeout': 1000,
    'state': { 'hue': 0 },
    'return_state': {}
  },args);

  new_args.children = [];

  new_args.lights.forEach(function(light, index){
    new_args.children.push(FlickerAnimation({
      'hue': light,
      'delay': new_args.timeout * 0.5 * index,
      'timeout': new_args.timeout,
      'state': new_args.state,
      'return_state': new_args.return_state,
      'compute_transition_time': function(){
        return Math.max(1,Math.floor((this.timeout/2) / 100));
      }
    }));
  });

  var animation = MultiAnimation(new_args);

  return mergeInto(animation, args);
};

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

var FishbowlManager = function(args){
  var new_args = merge({
    'start_state': function(light){
      return {'hue': 47000,
              'sat': 254,
              'bri': 254}
    },
    'next_state': function(light){
      return {'hue': 0,
              'sat': 254,
              'bri': 254};
    },
    'next_speed': function(light){
      return 20000;
    }
  }, args);

  var manager = HueAnimationManager(new_args);

  var state_backup = clone(manager.start_state())

  manager.get_next_animation = function(args) {
    var list = [];
    var start = randomInt(0,hue_list.length - 1);
    if (args.animation != null) {
      start = randomInt(0,hue_list.length - 2);
      if (args.animation.children[1].hue.index <= start) {
        start += 1;
      }
    }
    var end = randomInt(0,1) == 1 ? start + 1 : start - 1;
    if (start == 0){
      end = 1;
    } else if (start == hue_list.length - 1) {
      end = hue_list.length - 2;
    }
    list.push(hue_list[start]);
    list.push(hue_list[end]);
    console.log('new hue pair:');
    console.log(list);
    return CascadeAnimation({
      'lights': list,
      'timeout': manager.next_speed(),
      'state': manager.next_state(),
      'return_state': manager.start_state()
    });
  }

  return mergeInto(manager, args);
}

var UpdatingManager = function(args){
  var new_args = merge({
    'start_state': function(light){
      return {'hue': 47000,
              'sat': 254,
              'bri': 254}
    },
    'next_state': function(light){
      return {'hue': 0,
              'sat': 254,
              'bri': 254};
    },
    'next_speed': function(light){
      return 12000;
    }
  }, args);

  var manager = HueAnimationManager(new_args);

  manager.get_next_animation = function(args) {
    var num = randomInt(0,hue_list.length - 1);

    return SetStateAnimation({
      'hue': hue,
      'state': manager.next_state()
    });
  }

  return mergeInto(manager, args);
}

var FlashingManager = function(args){
  var new_args = merge({
    'start_state': function(light){
      return {'hue': 47000,
              'sat': 254,
              'bri': 254}
    },
    'next_state': function(light){
      return {'hue': 0,
              'sat': 254,
              'bri': 254};
    },
    'next_speed': function(light){
      return 12000;
    }
  }, args);

  var manager = HueAnimationManager(new_args);

  manager.get_next_animation = function(args) {
    var light = hue_list[randomInt(0,hue_list.length - 1)];

    return FlickerAnimation({
      'hue': light,
      'timeout': manager.next_speed(),
      'state': manager.next_state(args.hue),
      'return_state': manager.start_state(args.hue)
    });
  }

  return mergeInto(manager, args);
}

var CandleAnimation = function(args) {
  var animation = HueAnimation(merge({
    'type': 'candle',
    'timeout': 100,
    'next_timeout': function() { return this.timeout; },
    'compute_transition_time': function(){return Math.max(1,Math.floor(this.timeout / 100));}
  },args));

  var transitiontime = animation.compute_transition_time();
  animation._complete = false;
  animation.next_timeout = function() { return this.timeout; }
  animation.get_next_state = function(){
    console.log('candles changing');
    return {'bri': randomInt(200,254),
            'transitiontime': transitiontime};
  }

  console.log('candle animation created');

  return mergeInto(animation, args);
}

var CandlesAnimation = function(args) {
  var new_args = merge({
    'type': 'candles',
    'timeout': 100
  },args);

  new_args.children = [];

  new_args.lights.forEach(function(light, index){
    new_args.children.push(CandleAnimation({
      'hue': light,
      'timeout': new_args.timeout
    }));
  });

  var animation = MultiAnimation(new_args);

  return mergeInto(animation, args);
}

var CandleManager = function(args) {
  var new_args = merge({
    'next_timeout': function(light) {
      return 60000;
    },
    'next_speed': function(light){
      return 250;
    }
  }, args);

  var manager = HueAnimationManager(new_args);

  manager.get_start_animation = function(args) {
    return CandlesAnimation({
      'lights': hue_list,
      'timeout': manager.next_speed()
    });
  }

  return mergeInto(manager, args);
}

var SwapAnimation = function(args){
  var new_args = merge({
    'type': 'swap',
    'first_timeout': 10000,
    'second_timeout': 5000
  },args);

  new_args.children = [];

  var first_state = clone(new_args.lights[0].state);
  first_state.transitiontime = new_args.first_timeout;
  var second_state = clone(new_args.lights[1].state);
  second_state.transitiontime = new_args.second_timeout;

  console.log(first_state);
  console.log(second_state);

  new_args.children.push(SetStateAnimation({
    'hue': new_args.lights[1],
    'state': first_state,
    'delay': Math.max(0, new_args.second_timeout - new_args.first_timeout) / 2
  }));
  new_args.children.push(SetStateAnimation({
    'hue': new_args.lights[0],
    'state': second_state,
    'delay': Math.max(0, new_args.first_timeout - new_args.second_timeout) / 2
  }));

  var animation = MultiAnimation(new_args);

  return mergeInto(animation, args);
}

var SwappingManager = function(args) {
  var new_args = merge({
    'next_timeout': function(light) {
      return 5000;
    },
    'next_speed': function(light){
      return 10000;
    }
  }, args);

  var manager = HueAnimationManager(new_args);

  manager.get_next_animation = function(args) {
    var list = [];
    var start = randomInt(0,hue_list.length - 1);
    if (args.animation != null) {
      start = randomInt(0,hue_list.length - 2);
      if (args.animation.children[1].hue.index <= start) {
        start += 1;
      }
    }
    var end = randomInt(0,1) == 1 ? start + 1 : start - 1;
    if (start == 0){
      end = 1;
    } else if (start == hue_list.length - 1) {
      end = hue_list.length - 2;
    }
    list.push(hue_list[start]);
    list.push(hue_list[end]);
    console.log('new hue pair:');
    console.log(list);

    var speed = manager.next_speed();
    return SwapAnimation({
      'lights': list,
      'first_timeout': speed,
      'second_timeout': speed / 2
    });
  }

  return mergeInto(manager, args);
}

module.exports.host = host;
module.exports.path = path;
module.exports.HueAnimation = HueAnimation;
module.exports.HueAnimationManager = HueAnimationManager;
module.exports.SetStateAnimation = SetStateAnimation;
module.exports.FlickerAnimation = FlickerAnimation;
module.exports.CascadeAnimation = CascadeAnimation;
module.exports.CandleAnimation = CandleAnimation;
module.exports.CandlesAnimation = CandlesAnimation;
module.exports.SwapAnimation = SwapAnimation;
module.exports.FishbowlManager = FishbowlManager;
module.exports.UpdatingManager = UpdatingManager;
module.exports.FlashingManager = FlashingManager;
module.exports.CandleManager = CandleManager;
module.exports.SwappingManager = SwappingManager;
module.exports.update_hue_state = update_hue_state;
module.exports.commit_hue_list = commit_hue_list;
module.exports.hue_list = hue_list;
module.exports.init = init_hue;
