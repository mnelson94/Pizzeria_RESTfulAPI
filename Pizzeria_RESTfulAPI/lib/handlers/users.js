/*
 * User Handler – POST, GET, PUT, DELETE
 */

// Dependencies
var _data = require('../data'),
  helpers = require('../helpers'),
  config = require('../config'),
  tokens = require('./tokens'),
  util = require('util'),
  debug = util.debuglog('users');


// Container of the users submethods
// Required data: email, firstName, lastName, streetAddress, password, tosAgreement
// Optional data: none
users = {};

// Users – POST
users.post = function(data,callback){
  var _ = data.payload;

  // Check that all required fields are filled out
  var email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false,
    firstName = typeof(_.firstName) == 'string' && _.firstName.trim().length > 0 ? _.firstName.trim() : false,
    lastName = typeof(_.lastName) == 'string' && _.lastName.trim().length > 0 ? _.lastName.trim() : false,
    streetAddress = typeof(_.streetAddress) == 'string' && _.streetAddress.trim().length > 0 ? _.streetAddress.trim() : false,
    password = typeof(_.password) == 'string' && _.password.trim().length > 0 ? _.password.trim() : false,
    tosAgreement = typeof(_.tosAgreement) == 'boolean' && _.tosAgreement == true ? true : false;

  if(email && firstName && lastName && streetAddress && password && tosAgreement){
    // Make sure that the user doesn't already exist
    _data.read('users',email,function(err,data){
      if(err){
        // Hash the password
        var hashedPassword = helpers.hash(password);

        // Create the user object
        if(hashedPassword){
          var userObject = {
            'email' : email,
            'firstName' : firstName,
            'lastName' : lastName,
            'streetAddress' : streetAddress,
            'card' : 'tok_visa',
            'orders' : [],
            'hashedPassword' : hashedPassword,
            'tosAgreement' : true
          };

          // Store the user
          _data.create('users',email,userObject,function(err){
            if(!err){
              callback(200);
            } else {
              debug(err);
              callback(500,{'Error':'Could not create the new user.'})
            }
          });
        } else {
          callback(500,{'Error':'Could not hash the user\'s password.'});
        }
      } else {
        // User already exists
        callback(400,{'Error':'A user with that email already exists.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required fields.'});
  }
};

// Users – GET
// Required data: email
// Optional data: none
users.get = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the email provided is valid
  var email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false;
  if(email){
    // Get the token from the headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    tokens.verifyToken(token,email,function(tokenIsValid){
      if(tokenIsValid){
        // Lookup the user
        _data.read('users',email,function(err,userData){
          if(!err && userData){
            // Remove hashed password from the user object before returning it to the requester
            delete data.hashedPassword;
            callback(200,userData);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403,{'Error':'Missing required token in headers, or token is invalid.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Users – PUT
// Required data: email
// Optional data: firstName, lastName, password (at least one must be specified)
// @TODO only let an authenticated user update their own object. Don't let them update anyone else's.
users.put = function(data,callback){
  var _ = data.payload;

  // Check for the required field
  var email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false;

  // Check for the optional fields
  var firstName = typeof(_.firstName) == 'string' && _.firstName.trim().length > 0 ? _.firstName.trim() : false,
    lastName = typeof(_.lastName) == 'string' && _.lastName.trim().length > 0 ? _.lastName.trim() : false,
    streetAddress = typeof(_.streetAddress) == 'string' && _.streetAddress.trim().length > 0 ? _.streetAddress.trim() : false,
    password = typeof(_.password) == 'string' && _.password.trim().length > 0 ? _.password.trim() : false;

  // Error if the email is invalid
  if(email){
    // Error if nothing is sent to update
    if(firstName || lastName || streetAddress || password){
      // Get the token from the headers
      var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      // Verify that the given token is valid for the email
      tokens.verifyToken(token,email,function(tokenIsValid){
        if(tokenIsValid){
          // Lookup the user
          _data.read('users',email,function(err,userData){
            if(!err && userData){
              // Update the necessary fields
              if(firstName){
                userData.firstName = firstName;
              }
              if(lastName){
                userData.lastName = lastName;
              }
              if(lastName){
                userData.streetAddress = streetAddress;
              }
              if(password){
                userData.hashedPassword = helpers.hash(password);
              }

              // Store the new updates
              _data.update('users',email,userData,function(err){
                if(!err){
                  callback(200);
                } else {
                  debug(err);
                  callback(500,{'Error':'Could not update the user.'});
                }
              });
            } else {
              callback(400,{'Error':'The specified user does not exist.'});
            }
          });
        } else {
          callback(403,{'Error':'Missing required token in headers, or token is invalid.'});
        }
      });
    } else {
      callback(400,{'Error':'Missing fields to update.'});
    }
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Users – DELETE
// Required field: phone
users.delete = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the email provided is valid
  var email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false;
  if(email){
    // Get the token from the headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    tokens.verifyToken(token,email,function(tokenIsValid){
      if(tokenIsValid){
        // Lookup the user
        _data.read('users',email,function(err,userData){
          if(!err && userData){
            _data.delete('users',email,function(err){
              if(!err){
                // Delete each of the orders associated with the user
                var userOrders = typeof(userData.orders) == 'object' && userData.orders instanceof Array ? userData.orders : [],
                  ordersToDelete = userOrders.length;

                if(ordersToDelete){
                  var ordersDeleted = 0,
                    deletionErrors = false;

                  // Loop through the orders
                  userOrders.forEach(function(orderId){
                    // Delete the order
                    _data.delete('orders',orderId,function(err){
                      if(err){
                        deletionErrors = true;
                      } else {
                        ordersDeleted++;
                        if(ordersDeleted == ordersToDelete){
                          if(!deletionErrors){
                            callback(200);
                          } else {
                            callback(500,{'Error':'Errors encountered while trying to delete all the user\'s orders. All orders may not have been deleted from the system successfully.'})
                          }
                        }
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(500,{'Error':'Could not delete the specified user.'});
              }
            });
          } else {
            callback(400,{'Error':'Could not find the specified user.'});
          }
        });
      } else {
        callback(403,{'Error':'Missing required token in headers, or token is invalid.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Export the module
module.exports = users;
