/*
 * Worker-related tasks
 */

// Dependencies
var path = require('path'),
  fs = require('fs'),
  _data = require('./data'),
  https = require('https'),
  http = require('http'),
  helpers = require('./helpers'),
  url = require('url'),
  _logs = require('./logs'),
  util = require('util'),
  debug = util.debuglog('workers');

// Instantiate the worker object
var workers = {};

// lookup all orders, get their data, send to a validator
workers.gatherAllOrders = function(){
  // Get all the orders that exist in the system
  _data.list('orders',function(err,orders){
    if(!err && orders && orders.length > 0){
      orders.forEach(function(order){
        // Read in the order data
        _data.read('orders',order,function(err,originalOrderData){
          if(!err && originalOrderData){
            // Pass the data to the order validator, and let that function continue or log error
            workers.validateOrderData(originalOrderData);
          } else {
            debug('Error reading one of the orders data.');
          }
        });
      });
    } else {
      debug('Error: Could not find any orders to process.');
    }
  });
};

// Sanity checking the order-data
workers.validateOrderData = function(originalOrderData){
  var _ = originalOrderData;

  _ = typeof(_) == 'object' && _ !== null ? _ : {};
  _.id = typeof(_.id) == 'string' && _.id.trim().length == 20 ? _.id.trim() : false;
  _.email = typeof(_.email) == 'string' && helpers.validateEmail(_.email) ? _.email.trim() : false;
  _.order = typeof(_.order) == 'object' && _.order instanceof Array && _.order.length > 0 ? _.order : false;
  _.state = typeof(_.state) == 'string' && ['cart','submitted','paid'].indexOf(_.state) > -1 ? _.state : false;

  // If all the orders pass, pass the data along to the next step in the process
  if(_.id && _.email && _.order && _.state == 'submitted'){
    workers.processOrder(_);
  } else {
    debug('Error: One of the orders is not properly formatted. Skipping it.')
  }
};

// Process the order, send the originalOrderData and the outcome of the order process to the next step in the process
workers.processOrder = function(originalOrderData){
  var _ = originalOrderData;

  // Setup required data
  var isDone = false;
  var userEmail = _.email;

  _data.read('users',userEmail,function(err,userData){
    if(!err && userData){
      var details = helpers.compileOrder(_.order);

      if(details.total >= 0.01){
        helpers.pay(userData.card,_.id,details.total,function(err){
          if(!err){
            if(!isDone){
              workers.processSuccessfulPayment(userData,_,details);
              isDone = true;
            }
          } else {
            if(!isDone){
              workers.processFailedPayment(userData,_,details);
              isDone = true;
              debug(err);
            }
          }
        });
      } else {
        if(!isDone){
          // This order amounts to zero dollars
          // Remove it from the orders and the user's account
          workers.processFreeOrder(userData,_);
          isDone = true;
        }
      }
    } else {
      // Unmark the order as submitted (remove from the payment queue)
      if(!isDone){
        workers.processNoValidUser(_);
        isDone = true;
      }
    }
  });
};

// Process the successful payment of the order
// Mark the order as paid
// Alert the user by email
workers.processSuccessfulPayment = function(userData,originalOrderData,details) {
  // Log the transaction
  var date = Date.now();
  workers.log(originalOrderData,"paid",date);

  // Update the order data
  var newOrderData = originalOrderData;
  newOrderData.state = 'paid';
  newOrderData.timePaid = date;

  // Write to disk
  _data.update('orders',newOrderData.id,newOrderData,function(err){
    if (!err) {
      workers.alertUserEmail(userData,details);
    } else {
      debug('Error trying to save update on one of the orders.');
    }
  });
};

// Process the failed payment of the order
// Mark the order as create
// Do not email the user
workers.processFailedPayment = function(userData,originalOrderData,details) {
  // Log the transaction
  workers.log(originalOrderData,"failed",Date.now());

  // Update the order data
  var newOrderData = originalOrderData;
  newOrderData.state = 'cart';

  // Write to disk
  _data.update('orders',newOrderData.id,newOrderData,function(err){
    if(err){
      debug('Error trying to save update on one of the orders.');
    }
  });
};

//we cannot retrieve the user who owned this order...
workers.processNoValidUser = function(originalOrderData) {
  // Log the transaction
  workers.log(originalOrderData,"No Valid User",Date.now());

  // Update the order data
  var newOrderData = originalOrderData;
  newOrderData.state = 'cart';

  // Write to disk
  _data.update('orders',newOrderData.id,newOrderData,function(err){
    if(err){
      debug('Error trying to save update on one of the orders.');
    }
  });
};

// This order has a total bill of zero
workers.processFreeOrder = function(userData,orderData) {
  // Log the transaction
  workers.log(orderData,"Free Order",Date.now());

  // Delete the order
  _data.delete('orders',orderData.id,function(err){
    if(!err){
      var userOrders = typeof(userData.orders) == 'object' && userData.orders instanceof Array ? userData.orders : [],
        orderPosition = userOrders.indexOf(orderData.id);

      if(orderPosition > -1){
        //Remove the order
        userOrders.splice(orderPosition,1);

        // Update the user object
        _data.update('users',userData.email,userData,function(err){
          if (!err) {
            debug('Success: Free order removed.');
          } else {
            debug('Error: Could not update user object.');
          }
        });
      }
    } else {
      debug('Error: Could not find the order on the user object.');
    }
  });
};

workers.alertUserEmail = function(userData,details) {
  var email = userData.email,
    name = userData.firstName+' '+userData.lastName,
    message = name+'\n'+userData.streetAddress+'\n'+details.message;

  helpers.sendMailgunEmail(email,name,message,function(err){
    if(!err){
      debug('Success: User was alerted via Email ',message);
    } else {
      debug('Error: Could not alert the user via email',err);
    }
  });
}

// Log order info
workers.log = function(originalOrderData,outcome,time){
  // Form the log data
  var logData = {
    'order' : originalOrderData,
    'outcome' : outcome,
    'time' : time
  };

  // Convert data to a string
  var logString = JSON.stringify(logData);

  // Determine the name of the log file
  var logFileName = originalOrderData.id;

  // Append the log string to the file
  _logs.append(logFileName,logString,function(err){
    if(!err){
      debug('Logging to file succeeded.');
    } else {
      debug('Logging to file failed.');
    }
  });
};

// Timer to execute the worker-process once per minute
workers.loop = function(){
  setInterval(function(){
    workers.gatherAllOrders();
  },1000 * 60);
};

// Rotate (compress) the log files
workers.rotateLogs = function(){
  // List all the (non-compressed) log files
  _logs.list(false,function(err,logs){
    if(!err && logs && logs.length > 0){
      logs.forEach(function(logName){
        // Compress the data to a different file
        var logId = logName.replace('.log',''),
          newFileId = logId+'-'+Date.now();

        _logs.compress(logId,newFileId,function(err){
          if(!err){
            // Truncate the log
            _logs.truncate(logId,function(err){
              if(!err){
                debug('Success truncating log file.')
              } else {
                debug('Error truncating log file.')
              }
            });
          } else {
            debug('Error compressing one of the log files',err)
          }
        });
      });
    } else {
      debug('Error: Could not find any logs to rotate.')
    }
  });
}

// Timer to execute the log-rotation process once per day
workers.logRotationLoop = function(){
  setInterval(function(){
    workers.rotateLogs();
  },1000 * 60 * 60 * 24);
};

// Init function
workers.init = function(){
  // Send to console, in yellow
  console.log('\x1b[33m%s\x1b[0m','Background workers are running.');

  // Execute all the orders
  workers.gatherAllOrders();

  // Call the loop so that the orders will execute later on
  workers.loop();

  // Compress all the logs immediately
  workers.rotateLogs();

  // Call the compression loop so logs will be compressed later on
  workers.logRotationLoop();
};

// Export the module
module.exports = workers;
