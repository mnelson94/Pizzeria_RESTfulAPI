/*
 * Create and export configuration variations
 */

// Container for all the environments
var environments = {};

// Staging environment (default)
environments.staging = {
  'httpPort' : 3000,
  'httpsPort' : 3001,
  'envName' : 'staging',
  'hashingSecret' : 'thisIsASecret',
  'menu' : {
    1 : ["Pizza 1",'$1.00'],
    2 : ["Pizza 2",'$2.00'],
    3 : ["Pizza 3",'$3.00'],
    4 : ["Pizza 4",'$4.00'],
    5 : ["Pizza 5",'$5.00']
  },
  'mailgun' : {
    'from' : "Mailgun Sandbox <postmaster@sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org>",
    'key'  : "api:YOUR_API_KEY",
    'addr' : "https://api.mailgun.net/v3/sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org/messages"
  },
  'stripe' : {
    'pubkey' : 'pk_test_YOUR_API_KEY',
    'key' : 'sk_test_YOUR_API_KEY',
    'addr' : "https://api.stripe.com/v1/charges"
  }
};

// Production environment
environments.production = {
  'httpPort' : 5000,
  'httpsPort' : 5001,
  'envName' : 'production',
  'hashingSecret' : 'thisIsAlsoASecret',
  'menu' : {
    1 : ["Pizza 1",'$1.00'],
    2 : ["Pizza 2",'$2.00'],
    3 : ["Pizza 3",'$3.00'],
    4 : ["Pizza 4",'$4.00'],
    5 : ["Pizza 5",'$5.00']
  },
  'mailgun' : {
    'from' : "Mailgun Sandbox <postmaster@sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org>",
    'key'  : "api:YOUR_API_KEY",
    'addr' : "https://api.mailgun.net/v3/sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org/messages"
  },
  'stripe' : {
    'pubkey' : 'pk_test_YOUR_API_KEY',
    'key' : 'sk_test_YOUR_API_KEY',
    'addr' : "https://api.stripe.com/v1/charges"
  }
};

// Determine which environment was passed as a command-line argument
var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check that the current environment is one of the environements above, if not, default to Staging
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

// Export the module
module.exports = environmentToExport;
