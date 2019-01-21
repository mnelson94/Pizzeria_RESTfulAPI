/*
 * Orders Handler – POST, GET, PUT, DELETE
 */

// Dependencies
var _data = require('../data'),
  helpers = require('../helpers'),
  config = require('../config'),
  tokens = require('./tokens');


// Container for all the orders methods
orders = {};

// Orders - POST
// Required data: order
// Optional data: none
orders.post = function(data,callback){
  var _ = data.payload;

  // Validate the inputs
  var order = typeof(_.order) == 'object' && _.order instanceof Array && _.order.length > 0 ? _.order : false;

  if(order){
    // Get the token from the headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Lookup the user by reading the token
    _data.read('tokens',token,function(err,tokenData){
      if(!err && tokenData){
        var userEmail = tokenData.email;

        // Lookup the user data
        _data.read('users',userEmail,function(err,userData){
          if(!err && userData){
            var userOrders = typeof(userData.orders) == 'object' && userData.orders instanceof Array ? userData.orders : [];

            // Create a random id
            var orderId = helpers.createRandomString(20);

            // Create the order object, and include the user's email
            var orderObject = {
              'id' : orderId,
              'email' : userEmail,
              'order' : order,
              'state' : 'cart' // cart, submitted, paid
            };

            // Save the object
            _data.create('orders',orderId,orderObject,function(err){
              if(!err){
                // Add the order id to the user's object
                userData.orders = userOrders;
                userData.orders.push(orderId);

                // Save the new user data
                _data.update('users',userEmail,userData,function(err){
                  if(!err){
                    // Return the data about the new order
                    callback(200,orderObject);
                  } else {
                    callback(500,{'Error':'Could not update the user with the new order.'})
                  }
                });
              } else {
                callback(450,{'Error':'Could not create the new order.'});
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(403)
      }
    });
  } else {
    callback(400,{'Error':'Missing required inputs, or inputs are invalid.'})
  }
};

// Orders - GET
// Required data: id
// Optional data: none
orders.get = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the id is valid
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;

  if(id){
    // Lookup the order
    _data.read('orders',id,function(err,orderData){
      if(!err && orderData){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user that created the order
        tokens.verifyToken(token,orderData.email,function(tokenIsValid){
          if(tokenIsValid){
            // Return the order data
            callback(200,orderData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(404,err);
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'})
  }
};

// Orders - PUT
// Required data: id, order
// Optional data: none
orders.put = function(data,callback){
  var _ = data.payload;

  // Check for the required field
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false,
    order = typeof(_.order) == 'object' && _.order instanceof Array && _.order.length > 0 ? _.order : false;

  // Check to make sure id is valid
  if(id && order){
    // Lookup the order
    _data.read('orders',id,function(err,orderData){
      if(!err && orderData){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user that created the order
        tokens.verifyToken(token,orderData.email,function(tokenIsValid){
          if(tokenIsValid){
            if(orderData.state != 'submitted'){
              orderData.state = 'cart';
              orderData.order = order;

              // Update the order
              _data.update('orders',id,orderData,function(err){
                if(!err){
                  callback(200);
                } else {
                  callback(500,{'Error':'This order is being processed for payment and cannot be changed now.'})
                }
              });
            } else {
              callback(403,{'Error':'Order already processing.'});
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(400,{'Error':'Order ID did not exist.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field(s).'})
  }
};

// Orders - DELETE
// Required data: id
// Optional data: none
orders.delete = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the id is valid
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;
  if(id){
    // Lookup the order
    _data.read('orders',id,function(err,orderData){
      if(!err && orderData){
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that the given token is valid for the email
        tokens.verifyToken(token,orderData.email,function(tokenIsValid){
          if(tokenIsValid){
            // Delete the order data
            _data.delete('orders',id,function(err){
              if(!err){
                // Lookup the user
                _data.read('users',orderData.email,function(err,userData){
                  if(!err && userData){
                    var userOrders = typeof(userData.orders) == 'object' && userData.orders instanceof Array ? userData.orders : [];

                    // Remove the deleted order from their list of orders
                    var orderPosition = userOrders.indexOf(id);

                    if(orderPosition > -1){
                      userOrders.splice(orderPosition,1);

                      // Resave the user's data
                      _data.update('users',orderData.email,userData,function(err){
                        if(!err){
                          callback(200);
                        } else {
                          callback(500,{'Error':'Could not update the user.'});
                        }
                      });
                    } else {
                      callback(500,{'Error':'Could not find the order on the user\'s object, so could not remove the order.'});
                    }
                  } else {
                    callback(500,{'Error':'Could not find the user who created the order, so could not remove the order from the list of orders on the user object.'});
                  }
                });
              } else {
                callback(500,{'Error':'Could not delete the specified order.'})
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400,{'Error':'The specified ID does not exist.'})
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Export the module
module.exports = orders;
