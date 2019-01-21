/*
 * Request handlers
 */

// Dependencies
var helpers = require('./helpers'),
  _data = require('./data'),
  _users = require('./handlers/users'),
  _tokens = require('./handlers/tokens'),
  _orders = require('./handlers/orders');


// Container for all handlers
var handlers = {};

// Users handler
handlers.users = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];

  if(acceptableMethods.indexOf(data.method) > -1){
    _users[data.method](data,callback);
  } else {
    callback(405);
  }
};

// Tokens handler
handlers.tokens = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];

  if(acceptableMethods.indexOf(data.method) > -1){
    _tokens[data.method](data,callback);
  } else {
    callback(405);
  }
};

// Orders handler
handlers.orders = function(data,callback){
  var acceptableMethods = ['post','get','put','delete'];

  if(acceptableMethods.indexOf(data.method) > -1){
    _orders[data.method](data,callback);
  } else {
    callback(405);
  }
};

// Menu handler
handlers.menu = function(data,callback){
  // Get the token from the headers
  var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

  if(token){
    // Lookup the token
    _data.read('tokens',token,function(err,tokenData){
      if(!err && tokenData){
        // Verify that the given token is valid for the email
        tokens.verifyToken(token,tokenData.email,function(tokenIsValid){
          if(tokenIsValid){
            // Lookup the user
            _data.read('users',tokenData.email,function(err,userData){
              if(!err && userData){
                callback(200,helpers.listMenu());
              } else {
                callback(400,{'Error':'Could not find the specified user.'});
              }
            });
          } else {
            callback(403,{'Error':'Missing required token in headers, or token is invalid.'});
          }
        });
      } else {
        callback(400,{'Error':'Could not find the specified token.'})
      }
    });
  } else {
    callback(403,{'Error':'Missing required token in headers, or token is invalid.'})
  }
};

// Pay handler
// Required data: id
// Optional data: none
handlers.pay = function(data,callback){
  var _ = data.payload;

  // Validate required data
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;

  if(id){
    // Lookup the order
    _data.read('orders',id,function(err,orderData){
      if(!err && orderData){
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        //verify that the given token is valid
        _tokens.verifyToken(token,orderData.email,function(tokenIsValid){
          // Verify that the given token is valid for the email
          if(tokenIsValid){
            if(orderData.order.length > 0){
              // Check if the order has already been submitted
              if(orderData.state == "submitted"){
                // This order is being processed for payment, we must wait for the payment to finish
                callback(400,{'Error':'This order is already being processed for payment and cannot be changed now.'});
              } else {
                orderData.state = "submitted"; // Submitted for payment, the background workers will take care of it.

                _data.update('orders',id,orderData,function(err){
                  if(!err){
                    callback(200);
                  } else {
                    callback(500,{'Error':'Could not update the order.'});
                  }
                });
              }
            } else {
              callback(400,{'Error':'The order is empty.'});
            }
          } else {
            callback(403,{'Error':'Missing required token in headers, or token is invalid.'})
          }
        });
      } else {
        callback(400,{'Error':'Could not find the specified order.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required fields or fields are invalid.'});
  }
};

// Ping handler
handlers.ping = function(data,callback){
  callback(200);
};

// Not found handler
handlers.notFound = function(data,callback){
  callback(404,{data});
};

// Export the module
module.exports = handlers;
