/*
 * Token Handler – POST, GET, PUT, DELETE
 */

// Dependencies
var _data = require('../data'),
  helpers = require('../helpers'),
  config = require('../config');

// Container for all the tokens methods
tokens = {};

// Tokens – POST
// Required data: email, password
// Optional data: none
tokens.post = function(data,callback){
  var _ = data.payload;

  // Parse email and password
  var email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false,
    password = typeof(_.password) == 'string' && _.password.trim().length > 0 ? _.password.trim() : false;

  if(email && password){
    // Lookup the user who matches that email
    _data.read('users',email,function(err,userData){
      if(!err && userData){
        // Hash the sent password and compare it to the password stored in the user object
        var hashedPassword = helpers.hash(password);

        if(hashedPassword == userData.hashedPassword){
          // If valid, create a new token with a random name. Set expiration date 1 hour in the future.
          var tokenId = helpers.createRandomString(20),
            expires = Date.now() + 1000 * 60 * 60,
            tokenObject = {
              'email' : email,
              'id' : tokenId,
              'expires' : expires
            };

          // Store the token
          _data.create('tokens',tokenId,tokenObject,function(err){
            if(!err){
              callback(200,tokenObject);
            } else {
              callback(500,{'Error':'Could not create the new token.'});
            }
          });
        } else {
          callback(400,{'Error':'Password did not match the specified user\'s stored password.'});
        }
      } else {
        callback(400,{'Error':'Could not find the specified user.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field(s).'});
  }
};

// Tokens – GET
// Required data: id
// Optional data: none
tokens.get = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the id is valid
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;
  if(id){
    // Lookup the token
    _data.read('tokens',id,function(err,tokenData){
      if(!err && tokenData){
        callback(200,tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Tokens – PUT
// Required data: id, extend
// Optional data: none
tokens.put = function(data,callback){
  var _ = data.payload;

  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false,
    extend = typeof(_.extend) == 'boolean' && _.extend == true ? true : false;

  if(id && extend){
    // Lookup the token
    _data.read('tokens',id,function(err,tokenData){
      if(!err && tokenData){
        // Check to make sure that token hasn't expired
        if(tokenData.expires > Date.now()){
          // Set the expiration 1 hour from now
          tokenData.expires = Date.now() + 1000 * 60 *60;

          // Store the new updated expiration
          _data.update('tokens',id,tokenData,function(err){
            if(!err){
              callback(200);
            } else {
              callback(500,{'Error':'Could not update the token\'s expiration.'});
            }
          });
        } else {
          callback(400,{'Error':'The token has already expired and cannot be extended.'});
        }
      } else {
        callback(400,{'Error':'Specified token does not exist.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field(s) or field(s) are invalid.'});
  }
};

// Tokens – DELETE
// Required data: id
// Optional data: none
tokens.delete = function(data,callback){
  var _ = data.queryStringObject;

  // Check that the id provided is valid
  var id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;
  if(id){
    // Lookup the token
    _data.read('tokens',id,function(err,data){
      if(!err && data){
        _data.delete('tokens',id,function(err){
          if(!err){
            callback(200);
          } else {
            callback(500,{'Error':'Could not delete the specified token.'});
          }
        });
      } else {
        callback(400,{'Error':'Could not find the specified token.'});
      }
    });
  } else {
    callback(400,{'Error':'Missing required field.'});
  }
};

// Verify if a given token id is currently valid for a given user
tokens.verifyToken = function(id,email,callback){
  // Lookup the token
  _data.read('tokens',id,function(err,tokenData){
    if(!err && tokenData){
      // Check that the token is for the given user and has not expired
      if(tokenData.email == email && tokenData.expires > Date.now()){
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// Export the module
module.exports = tokens;
