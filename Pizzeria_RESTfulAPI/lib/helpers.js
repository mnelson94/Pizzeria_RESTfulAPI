/*
 * Helpers for various tasks
 */

// Dependencies
var crypto = require('crypto'),
  config = require('./config'),
  https = require('https'),
  querystring = require('querystring');

// Container for all the helpers
var helpers = {};

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function(strLength){
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;

  if(strLength){
    // Define all the possible characters that could go into a string
    var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Start the final string
    var str = '';

    for(i = 0; i < strLength; i++){
      // Get a random character from the possibleCharacters string
      var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));

      // Append this character to the final string
      str += randomCharacter;
    }

    // Return the final string
    return str;
  } else {
    return false;
  }
};

// Create a SHA256 hash
helpers.hash = function(str){
  if(typeof(str) == 'string' && str.length > 0){
    var hash = crypto.createHmac('sha256',config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

// Parse a JSON string to an object in all cases without throwing
helpers.parseJsonToObject = function(str){
  try {
    var obj = JSON.parse(str);
    return obj;
  } catch(e) {
    return {};
  }
};

// Validate email string
helpers.validateEmail = function(email){
  // Validate the email format
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  // Return email string if formatted correctly
  return re.test(String(email).toLowerCase());
};

// Compile order items and export cost and details
helpers.compileOrder = function(order){
  var total = 0.00,
    message = '';

  order.forEach(function(item){
    total += parseFloat(config.menu[item][1].substr(1));
    message += '\n'+config.menu[item][0]+': '+config.menu[item][1];
  });

  message += '\n\nTotal: $'+total.toFixed(2);

  return {
    'total' : total.toFixed(2),
    'message' : message
  };
};

// Call to return menu
helpers.listMenu = function(){
  return config.menu;
};

// Stripe payment processing
helpers.pay = function(card,orderId,total,callback) {
  // Validate required data
  card = typeof(card) == 'string' && ['tok_visa','tok_mastercard'].indexOf(card) > -1 ? card : false;
  orderId = typeof(orderId) == 'string' && orderId.trim().length == 20 ? orderId.trim() : false;
  total = parseFloat(total);
  total = typeof(total) == 'number' && total >= 0.01 ? total *100 : false;

  if(card && orderId && total){
    var date = new Date(),
    payload = {
      'amount' : total,
      'currency' : 'usd',
      'source' : card,
      'description' : 'Food delivery on '+date.toLocaleDateString("en-US"),
      'metadata' : {
        'orderId' : orderId
      }
    };

    // Convert payload to string
    var payloadString = querystring.stringify(payload);

    // Configure the request details
    var requestDetails = {
      'method':"POST",
      'auth' : config.stripe.key+':',
      'headers' : {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payloadString)
      }
    }

    // Instantiate the request object
    var req = https.request(config.stripe.addr,requestDetails,function(res){
      // Grab the status of the sent request
      var status = res.statusCode;

      // Callback successfully if the request went through
      if(status == 200 || status == 201){
        callback(false);
      } else {
        callback('Status code returned was '+status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error',function(e){
      callback(e);
    });

    // Add the payload
    req.write(payloadString);

    // End the request
    req.end();
  } else {
    callback('Given parameters were missing or invalid.');
  }
};

// Stripe payment processing
helpers.sendMailgunEmail = function(email,name,message,callback) {
  // Validate required data
  email = typeof(email) == 'string' && helpers.validateEmail(email) ? email.trim() : false;
  name = typeof(name) == 'string' && name.trim().length > 0 ? name.trim() : false;
  message = typeof(message) == 'string' && message.trim().length > 0 ? message.trim() : false;

  if(email && name && message){
    // Configure the request payload
    var payload = {
      'from' : config.mailgun.from,
      'to' : name+' <'+email+'>',
      'subject' : 'Order Successful',
      'text' : message
    };

    // Convert payload to string
    var payloadString = querystring.stringify(payload);

    // Configure the request details
    var requestDetails = {
      'method' : "POST",
      'auth' : config.mailgun.key,
      'headers' : {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payloadString),
      }
    };

    var req = https.request(config.mailgun.addr,requestDetails,function(res) {
      // Grab the status of the sent request
      var status = res.statusCode;

      // Callback successfully if the request went through
      if(status == 200 || status == 201){
        callback(false);
      } else {
        callback('Status code returned was '+status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error',function(e){
      callback(e);
    });

    // Add the payload
    req.write(payloadString);

    // End the request
    req.end();
  } else {
    callback('Given parameters were missing or invalid.');
  }
};

// Export the module
module.exports = helpers;
